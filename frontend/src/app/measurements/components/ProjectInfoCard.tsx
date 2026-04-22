"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MeasurementProject } from "@/types";
import { User, Calendar, FileText, Ruler } from "lucide-react";

interface ProjectInfoCardProps {
  project: MeasurementProject;
  onChange: (updates: Partial<MeasurementProject>) => void;
}

export function ProjectInfoCard({ project, onChange }: ProjectInfoCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="project-name" className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              Название объекта
            </Label>
            <Input
              id="project-name"
              value={project.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Например: Квартира на Ленина"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-name" className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              Клиент
            </Label>
            <Input
              id="client-name"
              value={project.client_name}
              onChange={(e) => onChange({ client_name: e.target.value })}
              placeholder="ФИО клиента"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="measurement-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              Дата замера
            </Label>
            <Input
              id="measurement-date"
              type="date"
              value={project.measurement_date}
              onChange={(e) => onChange({ measurement_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="measurer-name" className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-slate-400" />
              Замерщик
            </Label>
            <Input
              id="measurer-name"
              value={project.measurer_name}
              onChange={(e) => onChange({ measurer_name: e.target.value })}
              placeholder="Имя замерщика"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
