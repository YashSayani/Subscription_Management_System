import React from 'react';
import { Layers, Clock } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

interface PlaceholderPageProps {
  title: string;
  modulePhase: string;
  description: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  modulePhase,
  description,
}) => {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-emerald-400" />
            {title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">{description}</p>
        </div>
        <Badge variant="warning">
          <Clock className="h-3 w-3 mr-1 inline" />
          Scheduled for {modulePhase}
        </Badge>
      </div>

      <Card>
        <CardContent className="py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-400 mx-auto mb-4">
            <Layers className="h-6 w-6 text-emerald-400" />
          </div>
          <h3 className="text-base font-semibold text-white">{title} Module</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
            This module interface is mapped to the Brightloop backend services. It will be fully populated in {modulePhase} according to the engineering roadmap.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
