import {
  prisma,
  Prisma,
  InvoiceStatus,
} from '@brightloop/database';
import { UserRole } from '@brightloop/shared';
import { NotFoundError, BadRequestError } from '../../common/errors.js';
import { roundMoney } from '../../common/money.js';
import { AuthUser } from '../../common/types.js';
import { ListInvoicesQuery } from './schema.js';

export class InvoiceService {
  // ===================== LIST INVOICES =====================

  static async listInvoices(query: ListInvoicesQuery, requestingUser: AuthUser) {
    const where: Prisma.InvoiceWhereInput = {};
    const now = new Date();

    // Customer IDOR mitigation
    if (requestingUser.role === UserRole.CUSTOMER) {
      where.customerId = requestingUser.userId;
    } else if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.subscriptionId) {
      where.subscriptionId = query.subscriptionId;
    }

    if (query.status) {
      where.status = query.status;
    }

    // Dynamic Overdue filter (Decision D-09)
    if (query.isOverdue) {
      where.status = { in: [InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID] };
      where.dueDate = { lt: now };
    }

    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { customer: { email: { contains: query.search, mode: 'insensitive' } } },
        { subscription: { subscriptionNumber: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          customer: {
            select: { id: true, email: true, fullName: true, companyName: true, taxId: true, billingAddress: true },
          },
          subscription: {
            select: { id: true, subscriptionNumber: true, plan: { select: { name: true, billingFrequency: true } } },
          },
          lines: {
            include: {
              product: { select: { id: true, name: true } },
              variant: { select: { id: true, attributeName: true, attributeValue: true } },
            },
          },
          allocations: {
            include: {
              payment: {
                select: { paymentNumber: true, method: true, paymentDate: true },
              },
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    // Enhance each invoice with derived overdue status and remaining balance
    const mappedInvoices = invoices.map((inv) => {
      const isOverdue =
        (inv.status === InvoiceStatus.CONFIRMED || inv.status === InvoiceStatus.PARTIALLY_PAID) &&
        new Date(inv.dueDate) < now;

      const balanceDue = roundMoney(new Prisma.Decimal(inv.totalAmount).minus(inv.paidAmount));

      return {
        ...inv,
        isOverdue,
        balanceDue: balanceDue.toFixed(2),
        subtotal: inv.subtotal.toFixed(2),
        discountAmount: inv.discountAmount.toFixed(2),
        taxAmount: inv.taxAmount.toFixed(2),
        totalAmount: inv.totalAmount.toFixed(2),
        paidAmount: inv.paidAmount.toFixed(2),
      };
    });

    return {
      invoices: mappedInvoices,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  // ===================== GET INVOICE BY ID =====================

  static async getInvoiceById(id: string, requestingUser: AuthUser) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, email: true, fullName: true, companyName: true, taxId: true, billingAddress: true, creditBalance: true },
        },
        subscription: {
          select: { id: true, subscriptionNumber: true, plan: { select: { name: true, billingFrequency: true } } },
        },
        lines: {
          include: {
            product: { select: { id: true, name: true } },
            variant: { select: { id: true, attributeName: true, attributeValue: true } },
          },
        },
        allocations: {
          include: {
            payment: {
              select: { paymentNumber: true, method: true, paymentDate: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice with ID '${id}' not found`);
    }

    // Customer IDOR protection
    if (requestingUser.role === UserRole.CUSTOMER && invoice.customerId !== requestingUser.userId) {
      throw new NotFoundError(`Invoice with ID '${id}' not found`);
    }

    const now = new Date();
    const isOverdue =
      (invoice.status === InvoiceStatus.CONFIRMED || invoice.status === InvoiceStatus.PARTIALLY_PAID) &&
      new Date(invoice.dueDate) < now;

    const balanceDue = roundMoney(new Prisma.Decimal(invoice.totalAmount).minus(invoice.paidAmount));

    return {
      ...invoice,
      isOverdue,
      balanceDue: balanceDue.toFixed(2),
      subtotal: invoice.subtotal.toFixed(2),
      discountAmount: invoice.discountAmount.toFixed(2),
      taxAmount: invoice.taxAmount.toFixed(2),
      totalAmount: invoice.totalAmount.toFixed(2),
      paidAmount: invoice.paidAmount.toFixed(2),
    };
  }

  // ===================== CANCEL / VOID INVOICE =====================

  static async cancelInvoice(id: string, reason?: string) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new NotFoundError(`Invoice with ID '${id}' not found`);
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestError('Cannot cancel a fully settled (PAID) invoice.');
    }

    if (new Prisma.Decimal(invoice.paidAmount).greaterThan(0)) {
      throw new BadRequestError(
        'Cannot cancel an invoice with allocated payments. Reallocate or refund payments first.',
      );
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestError('Invoice is already CANCELLED.');
    }

    const now = new Date();
    const updatedNotes = invoice.notes
      ? `${invoice.notes}\n[${now.toISOString()}] Voided by Admin. Reason: ${reason || 'N/A'}`
      : `[${now.toISOString()}] Voided by Admin. Reason: ${reason || 'N/A'}`;

    return prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CANCELLED,
        notes: updatedNotes,
      },
    });
  }

  // ===================== PRINT / PDF EXPORT HTML =====================

  static async generatePrintHtml(id: string, requestingUser: AuthUser): Promise<string> {
    const invoice = await this.getInvoiceById(id, requestingUser);

    const periodStart = new Date(invoice.periodStartDate).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const periodEnd = new Date(invoice.periodEndDate).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const linesHtml = invoice.lines
      .map(
        (line, idx) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">
            <strong>${line.description}</strong>
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${line.quantity}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">₹${Number(line.unitPrice).toFixed(2)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${line.taxRate}% (₹${Number(line.taxAmount).toFixed(2)})</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold;">₹${Number(line.totalAmount).toFixed(2)}</td>
        </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoice.invoiceNumber}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 40px;
      background: #ffffff;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
    .brand-sub {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .meta-box {
      text-align: right;
    }
    .invoice-badge {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      padding: 4px 12px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 13px;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 30px;
      font-size: 13px;
    }
    .section-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 24px;
    }
    th {
      background: #f8fafc;
      padding: 10px 12px;
      text-align: left;
      font-weight: 700;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    .summary-box {
      margin-left: auto;
      width: 300px;
      font-size: 13px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .summary-row.total {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      margin-top: 8px;
      padding: 10px 0;
    }
    .footer-note {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      .invoice-card { border: none; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 800px; margin: 0 auto 16px; text-align: right;">
    <button onclick="window.print()" style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">
      Print / Save as PDF
    </button>
  </div>

  <div class="invoice-card">
    <div class="header">
      <div>
        <h1 class="brand-title">BRIGHTLOOP SOFTWARE</h1>
        <div class="brand-sub">Subscription Management System • Tax Invoice</div>
      </div>
      <div class="meta-box">
        <div class="invoice-badge">${invoice.status}</div>
        <div style="margin-top: 8px; font-family: monospace; font-size: 16px; font-weight: 800;">${invoice.invoiceNumber}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Date: ${new Date(invoice.createdAt).toLocaleDateString()}</div>
      </div>
    </div>

    <div class="details-grid">
      <div>
        <div class="section-label">Billed To:</div>
        <strong>${invoice.customer?.fullName}</strong><br>
        ${invoice.customer?.companyName ? `<div>${invoice.customer.companyName}</div>` : ''}
        ${invoice.customer?.taxId ? `<div>Tax / GSTIN: ${invoice.customer.taxId}</div>` : ''}
        <div>${invoice.customer?.email}</div>
        ${invoice.customer?.billingAddress ? `<div>${invoice.customer.billingAddress}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <div class="section-label">Subscription & Terms:</div>
        <div>Agreement: <strong>${invoice.subscription?.subscriptionNumber}</strong></div>
        <div>Plan: ${invoice.subscription?.plan?.name} (${invoice.subscription?.plan?.billingFrequency})</div>
        <div>Billing Period: ${periodStart} – ${periodEnd}</div>
        <div style="color: #dc2626; font-weight: 600;">Due Date: ${dueDate}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">#</th>
          <th>Service / Product Description</th>
          <th style="width: 60px; text-align: center;">Qty</th>
          <th style="width: 100px; text-align: right;">Unit Price</th>
          <th style="width: 120px; text-align: right;">Tax Rate</th>
          <th style="width: 110px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${linesHtml}
      </tbody>
    </table>

    <div class="summary-box">
      <div class="summary-row">
        <span>Subtotal:</span>
        <span style="font-family: monospace;">₹${invoice.subtotal}</span>
      </div>
      ${
        Number(invoice.discountAmount) > 0
          ? `<div class="summary-row" style="color: #059669;">
               <span>Discount:</span>
               <span style="font-family: monospace;">-₹${invoice.discountAmount}</span>
             </div>`
          : ''
      }
      <div class="summary-row">
        <span>Total Tax (GST):</span>
        <span style="font-family: monospace;">₹${invoice.taxAmount}</span>
      </div>
      <div class="summary-row total">
        <span>Invoice Total:</span>
        <span style="font-family: monospace;">₹${invoice.totalAmount}</span>
      </div>
      <div class="summary-row">
        <span>Paid to Date:</span>
        <span style="font-family: monospace;">₹${invoice.paidAmount}</span>
      </div>
      <div class="summary-row" style="font-weight: 700; color: #dc2626;">
        <span>Balance Due:</span>
        <span style="font-family: monospace;">₹${invoice.balanceDue}</span>
      </div>
    </div>

    <div class="footer-note">
      This is a computer-generated invoice from Brightloop Subscription Management System.<br>
      Direct bank transfers must quote invoice number <strong>${invoice.invoiceNumber}</strong>.
    </div>
  </div>
</body>
</html>`;
  }
}
