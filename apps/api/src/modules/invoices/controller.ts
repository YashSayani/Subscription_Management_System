import { Request, Response } from 'express';
import { sendSuccess } from '../../common/response.js';
import { InvoiceService } from './service.js';
import { ListInvoicesQuery, CancelInvoiceInput } from './schema.js';

export class InvoiceController {
  static async listInvoices(req: Request, res: Response) {
    const { invoices, meta } = await InvoiceService.listInvoices(
      req.query as unknown as ListInvoicesQuery,
      req.user!,
    );
    sendSuccess(res, { invoices }, 200, meta);
  }

  static async getInvoice(req: Request, res: Response) {
    const invoice = await InvoiceService.getInvoiceById(req.params.id, req.user!);
    sendSuccess(res, { invoice });
  }

  static async cancelInvoice(req: Request, res: Response) {
    const { reason } = req.body as CancelInvoiceInput;
    const invoice = await InvoiceService.cancelInvoice(req.params.id, reason);
    sendSuccess(res, { invoice, message: 'Invoice successfully cancelled / voided' });
  }

  static async printInvoice(req: Request, res: Response) {
    const html = await InvoiceService.generatePrintHtml(req.params.id, req.user!);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
