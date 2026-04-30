import { useState, useEffect, useMemo, useRef } from 'react';
import { insforge } from '../lib/insforge';
import { Calendar, Clock, CheckCircle, AlertCircle, Plus, Trash2, TrendingUp, ShieldCheck, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { format, addDays, parseISO, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';

interface ProjectTrackingProps {
  project: any;
  tasks: any[];
  roles: any[];
  onProjectUpdate: (updatedProject: any) => void;
  isSidebarOpen?: boolean;
}

export default function ProjectTracking({ project, tasks, roles, onProjectUpdate, isSidebarOpen = true }: ProjectTrackingProps) {
  const [startDate, setStartDate] = useState(project.start_date || '');
  const [workingDays, setWorkingDays] = useState<number[]>(project.working_days || [1, 2, 3, 4, 5]);
  const [holidays, setHolidays] = useState<any[]>(project.holidays || []);
  const [autoHolidays, setAutoHolidays] = useState<{date: string, name: string}[]>([]);
  const [newHoliday, setNewHoliday] = useState('');
  const [newHolidayHours, setNewHolidayHours] = useState('0');
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [trackingMode, setTrackingMode] = useState<'linear' | 'parallel'>(project.tracking_mode || 'linear');
  const [targetDate, setTargetDate] = useState(project.target_delivery_date || '');
  const [localTasks, setLocalTasks] = useState<any[]>(tasks);
  const [ganttView, setGanttView] = useState<'ideal' | 'projected'>('projected');
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);
  const [isGanttCollapsed, setIsGanttCollapsed] = useState(false);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);
  
  // Refs para el scroll por arrastre
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Sincronizar estados locales con los datos del proyecto cuando cambian externamente
  useEffect(() => {
    if (project.start_date) setStartDate(project.start_date);
    if (project.working_days) setWorkingDays(project.working_days);
    if (project.holidays) setHolidays(project.holidays);
    if (project.auto_holidays) setAutoHolidays(project.auto_holidays);
    if (project.tracking_mode) setTrackingMode(project.tracking_mode);
    if (project.target_delivery_date) setTargetDate(project.target_delivery_date);
  }, [project.id, project.tracking_mode]);

  useEffect(() => {
    if (!project.auto_holidays || project.auto_holidays.length === 0) {
      fetchAutoHolidays();
    } else {
      setAutoHolidays(project.auto_holidays);
    }
  }, [project.id]);



  const fetchAutoHolidays = async () => {
    setLoadingHolidays(true);
    try {
      const year = new Date().getFullYear();
      const responses = await Promise.all([
        fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/CL`),
        fetch(`https://date.nager.at/api/v3/PublicHolidays/${year + 1}/CL`)
      ]);
      const data = await Promise.all(responses.map(r => r.json()));
      const holidayData = data.flat().map((h: any) => ({
        date: h.date,
        name: h.localName
      }));
      
      setAutoHolidays(holidayData);
      handleUpdateConfig({ auto_holidays: holidayData });
    } catch (err) {
      console.error("Error cargando feriados:", err);
    } finally {
      setLoadingHolidays(false);
    }
  };

  const allHolidays = useMemo(() => {
    // Normalizar feriados manuales (pueden ser string o objeto)
    const manual = (holidays || []).map(h => {
      if (typeof h === 'string') return { date: h, name: 'Feriado Total', hours: 0, isManual: true };
      return { ...h, isManual: true };
    });
    const auto = (autoHolidays || []).map(h => ({ date: h.date, name: h.name, hours: 0, isManual: false }));
    return [...manual, ...auto].sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, autoHolidays]);

  const totalHours = tasks.reduce((acc, t) => acc + (Number(t.estimated_hours) || 0), 0);
  
  const daysOfWeek = [
    { id: 1, name: 'Lun' }, { id: 2, name: 'Mar' }, { id: 3, name: 'Mié' }, 
    { id: 4, name: 'Jue' }, { id: 5, name: 'Vie' }, { id: 6, name: 'Sáb' }, { id: 0, name: 'Dom' },
  ];

  const handleUpdateConfig = async (updates: any) => {
    setIsSaving(true);
    const { error } = await insforge.database
      .from('projects')
      .update(updates)
      .eq('id', project.id);
    
    if (error) {
      console.error("Error al guardar:", error);
    } else {
      onProjectUpdate({ ...project, ...updates });
    }
    setTimeout(() => setIsSaving(false), 800);
  };

  const handleFinalizeProject = async () => {
    if (totalProgress < 100 || project.status === 'completed') return;
    setIsSaving(true);
    const { error } = await insforge.database
      .from('projects')
      .update({ status: 'completed' })
      .eq('id', project.id);
    
    if (error) {
      console.error("Error al finalizar el proyecto:", error);
    } else {
      onProjectUpdate({ ...project, status: 'completed' });
    }
    setTimeout(() => setIsSaving(false), 800);
  };

  const toggleDay = (dayId: number) => {
    const newDays = workingDays.includes(dayId)
      ? workingDays.filter(d => d !== dayId)
      : [...workingDays, dayId];
    setWorkingDays(newDays);
    handleUpdateConfig({ working_days: newDays });
  };

  const addHoliday = () => {
    if (!newHoliday) return;
    const dateAlreadyExists = holidays.some((h: any) => (typeof h === 'string' ? h : h.date) === newHoliday);
    if (dateAlreadyExists) return;

    const holidayObj = { 
      date: newHoliday, 
      hours: Number(newHolidayHours), 
      name: Number(newHolidayHours) === 0 ? 'Feriado Total' : `Jornada ${newHolidayHours}h` 
    };
    
    const newHolidays = [...holidays, holidayObj];
    setHolidays(newHolidays);
    handleUpdateConfig({ holidays: newHolidays });
    setNewHoliday('');
    setNewHolidayHours('0');
  };

  const removeHoliday = (date: string) => {
    const newHolidays = holidays.filter((h: any) => (typeof h === 'string' ? h : h.date) !== date);
    setHolidays(newHolidays);
    handleUpdateConfig({ holidays: newHolidays });
  };  const calculateEndWithWeekends = (startDate: Date, workingHours: number) => {
    let current = new Date(startDate);
    let remainingHours = workingHours;
    const hoursPerDay = project.hours_per_day || 8;
    
    while (remainingHours > 0) {
      const isWorking = workingDays.includes(current.getDay());
      const dateStr = format(current, 'yyyy-MM-dd');
      const isHoliday = allHolidays.some(h => h.date === dateStr);
      
      if (isWorking && !isHoliday) {
        if (remainingHours <= hoursPerDay) {
          current = new Date(current.getTime() + (remainingHours / hoursPerDay) * 24 * 60 * 60 * 1000);
          remainingHours = 0;
        } else {
          remainingHours -= hoursPerDay;
          current = addDays(current, 1);
        }
      } else {
        current = addDays(current, 1);
      }
    }
    return current;
  };

  const projectStartDate = useMemo(() => {
    let d = new Date();
    if (startDate && startDate.includes('-')) {
      const [year, month, day] = startDate.split('-');
      d = new Date(Number(year), Number(month) - 1, Number(day), 9, 0, 0);
    } else {
      d.setHours(9, 0, 0, 0);
    }
    return d;
  }, [startDate]);

  const dualSchedule = useMemo(() => {
    if (!startDate || localTasks.length === 0) return { ideal: [], projected: [] };
    
    const startDateObj = projectStartDate;
    
    const buildTasks = (useProgress: boolean) => {
      const result: Task[] = [];
      const taskDates = new Map<string, { start: Date, end: Date }>();
      
      const getTaskDates = (taskId: string): { start: Date, end: Date } => {
        if (taskDates.has(taskId)) return taskDates.get(taskId)!;
        
        const t = localTasks.find(x => x.id === taskId);
        if (!t) return { start: startDateObj, end: addDays(startDateObj, 1) };
        
        let baseStart = new Date(startDateObj);
        const hasStarted = useProgress && t.actual_start_date && (t.progress || 0) > 0;
        
        if (hasStarted) {
            baseStart = parseISO(t.actual_start_date!);
            if (baseStart < startDateObj) {
              baseStart = new Date(startDateObj);
            }
        } else if (t.predecessor_id) {
          const pred = getTaskDates(t.predecessor_id);
          baseStart = new Date(pred.end);
        } else if (trackingMode === 'linear') {
          const leaves = localTasks.filter(x => !localTasks.some(child => child.parent_id === x.id));
          const index = leaves.findIndex(x => x.id === t.id);
          if (index > 0) {
             const prevTask = leaves[index - 1];
             const prev = getTaskDates(prevTask.id);
             baseStart = new Date(prev.end);
          }
        }
        
        let remainingHours = Number(t.estimated_hours || 0);
        let end = new Date(baseStart);

        if (!useProgress || !hasStarted) {
            // Plan Ideal OR 0% Progress: perfectly follows the theory
            end = remainingHours > 0 
              ? calculateEndWithWeekends(baseStart, remainingHours)
              : new Date(baseStart.getTime() + 2 * 60 * 60 * 1000);
        } else {
            // Ejecución Real (En Progreso o Completado)
            if (t.progress === 100) {
                end = t.actual_end_date ? parseISO(t.actual_end_date) : new Date(baseStart.getTime() + 2 * 60 * 60 * 1000);
                if (end.getTime() < baseStart.getTime()) {
                    end = new Date(baseStart.getTime() + 2 * 60 * 60 * 1000);
                }
            } else {
                remainingHours = remainingHours * (1 - (Number(t.progress || 0) / 100));
                // Calculamos lo que falta desde AHORA (o desde el inicio si es en el futuro)
                const calcStart = new Date(Math.max(baseStart.getTime(), new Date().getTime()));
                end = remainingHours > 0 
                    ? calculateEndWithWeekends(calcStart, remainingHours)
                    : new Date(calcStart.getTime() + 2 * 60 * 60 * 1000);
            }
        } 
          
        const dates = { start: baseStart, end: end };
        taskDates.set(taskId, dates);
        return dates;
      };
      
      localTasks.forEach(t => {
         const hasChildren = localTasks.some(child => child.parent_id === t.id);
         if (hasChildren) return;
         
         const dates = getTaskDates(t.id);
         const roleColor = roles.find((r: any) => r.id === t.assigned_role_id)?.color_hex || '#4fd1c5';
         
         result.push({
            id: t.id,
            name: t.task_name,
            start: dates.start,
            end: dates.end,
            progress: useProgress ? (t.progress || 0) : 0,
            dependencies: t.predecessor_id ? [t.predecessor_id] : undefined,
            type: 'task',
            project: project.id,
            styles: {
               backgroundColor: ganttView === 'ideal' && useProgress === false ? `${roleColor}88` : roleColor,
               progressColor: 'rgba(255,255,255,0.3)',
               progressSelectedColor: 'rgba(255,255,255,0.5)',
            }
         });
      });
      
      return result.sort((a, b) => a.start.getTime() - b.start.getTime());
    };

    return {
      ideal: buildTasks(false),
      projected: buildTasks(true)
    };
  }, [startDate, localTasks, roles, workingDays, allHolidays, trackingMode, project.hours_per_day, ganttView]);

  const idealEndDate = dualSchedule.ideal.length > 0 ? new Date(Math.max(...dualSchedule.ideal.map((t: any) => t.end.getTime()))) : null;
  const projectedEndDate = dualSchedule.projected.length > 0 ? new Date(Math.max(...dualSchedule.projected.map((t: any) => t.end.getTime()))) : null;
  const endDate = idealEndDate;

  // Automatización de Fecha Objetivo (Solo si no existe)
  useEffect(() => {
    if (!targetDate && endDate) {
      const dateStr = format(endDate, 'yyyy-MM-dd');
      setTargetDate(dateStr);
      handleUpdateConfig({ target_delivery_date: dateStr });
    }
  }, [endDate, targetDate]);

  const renderTrackingNode = (taskId: string | null, depth = 0) => {
    const nodes = localTasks.filter(t => t.parent_id === taskId);
    // Sort nodes by their original order (index in localTasks)
    nodes.sort((a, b) => localTasks.indexOf(a) - localTasks.indexOf(b));

    return nodes.map(task => {
      const children = localTasks.filter(c => c.parent_id === task.id);
      const isLeaf = children.length === 0;
      
      const predecessor = task.predecessor_id ? localTasks.find(p => p.id === task.predecessor_id) : null;
      const isBlocked = predecessor && Number(predecessor.progress || 0) < 100;

      // Calcular progreso del padre basado en hijos recursivamente
      const getAverageProgress = (tId: string): number => {
        const c = localTasks.filter(x => x.parent_id === tId);
        if (c.length === 0) return localTasks.find(x => x.id === tId)?.progress || 0;
        return Math.round(c.reduce((acc, child) => acc + getAverageProgress(child.id), 0) / c.length);
      };

      const progress = isLeaf ? (task.progress || 0) : getAverageProgress(task.id);

                    return (
                      <div key={task.id} className={`tracking-tree-node`}>
                        <div 
                          className={`tracking-task-row ${isBlocked ? 'blocked' : ''} ${!isLeaf ? 'parent-row' : 'leaf-row'}`}
                          style={{ '--depth': depth } as any}
                        >
                          <div className="t-info">
                            <div className="flex align-center gap-10">
                              {!isLeaf && <span className="p-dot"></span>}
                              <span className="t-name">{task.task_name}</span>
                              {isBlocked && <span className="blocked-tag">Bloqueada</span>}
                            </div>
                            <span className="t-meta">
                              {isLeaf && (roles.find((r: any) => r.id === task.assigned_role_id)?.name || 'Sin perfil')}
                              {task.actual_start_date && ` • Iniciado: ${format(Math.max(parseISO(task.actual_start_date).getTime(), projectStartDate.getTime()), 'dd/MM')}`}
                              {task.actual_end_date && ` • Fin: ${format(Math.max(parseISO(task.actual_end_date).getTime(), projectStartDate.getTime()), 'dd/MM')}`}
                            </span>
                          </div>
                          <div className="t-action">
                            {isLeaf ? (
                              <div className="flex items-center justify-end w-full gap-3">
                                <input 
                                  type="range" 
                                  min="0" max="100" 
                                  value={task.progress || 0}
                                  disabled={isBlocked}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setLocalTasks(prev => prev.map(t => t.id === task.id ? { ...t, progress: val } : t));
                                  }}
                                  onMouseUp={async (e: any) => {
                                    const val = parseInt(e.target.value);
                                    const updates: any = { progress: val };
                                    
                                    const oldTask = tasks.find(t => t.id === task.id);
                                    const now = new Date();
                                    
                                    if (val > 0 && !oldTask?.actual_start_date) {
                                      updates.actual_start_date = now < projectStartDate ? projectStartDate.toISOString() : now.toISOString();
                                    }
                                    if (val === 100 && !oldTask?.actual_end_date) {
                                      updates.actual_end_date = now < projectStartDate ? projectStartDate.toISOString() : now.toISOString();
                                    }

                                    await insforge.database.from('tasks').update(updates).eq('id', task.id);
                                  }}
                                  className="progress-slider-v4"
                                  style={{ width: '100%' }}
                                />
                                <span className="t-pct" style={{ minWidth: '45px' }}>{task.progress || 0}%</span>
                              </div>
                            ) : (
                              <div className="parent-progress-mini">
                                <div className="p-mini-fill" style={{ width: `${progress}%` }}></div>
                              </div>
                            )}
                          </div>
                        </div>
                        {children.length > 0 && renderTrackingNode(task.id, depth + 1)}
                      </div>
                    );
    });
  };

  const totalProgress = useMemo(() => {
    const leafTasks = localTasks.filter(t => !localTasks.some(child => child.parent_id === t.id));
    if (leafTasks.length === 0) return 0;
    const weightedSum = leafTasks.reduce((acc, t) => acc + (Number(t.progress || 0) * Number(t.estimated_hours || 0)), 0);
    const totalEstHours = leafTasks.reduce((acc, t) => acc + Number(t.estimated_hours || 0), 0);
    return totalEstHours > 0 ? Math.round(weightedSum / totalEstHours) : 0;
  }, [localTasks]);



  // Handlers para el scroll por arrastre
  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollRef.current?.offsetLeft || 0));
    setScrollLeft(scrollRef.current?.scrollLeft || 0);
  };

  const onMouseLeave = () => setIsDragging(false);
  const onMouseUp = () => setIsDragging(false);

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (scrollRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 2;
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className={`tracking-wrapper ${isSidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <div className="tracking-layout">
        {/* Barra Lateral de Configuración */}
        <div className="tracking-sidebar scroll-styled">
          <div className="glass-card config-panel-v4">
            <div className="section-title">
              <Calendar size={18} />
              <span>Planificación</span>
              {isSaving ? (
                <span className="saving-tag animate-pulse">Sincronizando...</span>
              ) : (
                <span className="saved-tag"><CheckCircle size={10} /> Guardado</span>
              )}
            </div>

            <div className="config-group">
              <label className="config-label">Modo de Seguimiento</label>
              <div className="mode-toggle-v4">
                <button 
                  className={`mode-btn ${trackingMode === 'linear' ? 'active' : ''}`}
                  onClick={() => {
                    setTrackingMode('linear');
                    handleUpdateConfig({ tracking_mode: 'linear' });
                  }}
                >
                  Lineal
                </button>
                <button 
                  className={`mode-btn ${trackingMode === 'parallel' ? 'active' : ''}`}
                  onClick={() => {
                    setTrackingMode('parallel');
                    handleUpdateConfig({ tracking_mode: 'parallel' });
                  }}
                >
                  Paralelo
                </button>
              </div>
              <p className="mode-helper">
                {trackingMode === 'linear' 
                  ? "Suma todas las horas secuencialmente." 
                  : "Considera dependencias y capacidad del equipo."}
              </p>
            </div>

            <div className="config-group">
              <label className="config-label">Jornada Laboral (Hrs/Día)</label>
              <input 
                type="number" 
                value={project.hours_per_day || 8} 
                onChange={(e) => handleUpdateConfig({ hours_per_day: parseInt(e.target.value) || 8 })}
                className="premium-input-v4"
                min="1" max="24"
              />
            </div>

            <div className="config-group">
              <label className="config-label">Fecha de Inicio</label>
              <input 
                type="date" 
                value={startDate} 
                min={today}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  handleUpdateConfig({ start_date: e.target.value });
                }}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="premium-date-input"
              />
            </div>

            <div className="config-group">
              <label className="config-label">Jornada Laboral</label>
              <div 
                className="day-scroll-v4" 
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseLeave={onMouseLeave}
                onMouseUp={onMouseUp}
                onMouseMove={onMouseMove}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <div className="day-flex-v4">
                  {daysOfWeek.map(day => (
                    <button
                      key={day.id}
                      className={`day-btn-v4 ${workingDays.includes(day.id) ? 'active' : ''}`}
                      onClick={() => toggleDay(day.id)}
                    >
                      {day.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="config-group">
              <label className="config-label">Feriados y Excepciones</label>
              <div className="holiday-input-stack-v4">
                <input 
                  type="date" 
                  className="premium-date-input"
                  value={newHoliday}
                  min={today}
                  onChange={(e) => setNewHoliday(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                />
                
                <div className="hours-selector-v4">
                  {[
                    { label: 'Total', val: '0' },
                    { label: '2h', val: '2' },
                    { label: '4h', val: '4' },
                    { label: '6h', val: '6' }
                  ].map(chip => (
                    <button
                      key={chip.val}
                      className={`hour-chip-v4 ${newHolidayHours === chip.val ? 'active' : ''}`}
                      onClick={() => setNewHolidayHours(chip.val)}
                    >
                      {chip.label}
                    </button>
                  ))}
                  <button className="add-holiday-btn-v4 large" onClick={addHoliday}>
                    <Plus size={24} strokeWidth={3} />
                  </button>
                </div>
                <p className="hours-helper-text">Define las horas laborables para esta fecha (0h = Feriado Total)</p>
              </div>
              
              <div className="unified-list-v4 scroll-styled" style={{ marginTop: '15px' }}>
                {loadingHolidays && <p className="loading-small">Sincronizando feriados...</p>}
                {allHolidays
                  .filter(h => h.date >= format(new Date(), 'yyyy-MM-dd'))
                  .map((h, i) => (
                    <div key={i} className={`holiday-row-v4 ${h.isManual ? 'manual' : 'auto'}`}>
                      <div className="h-left">
                        {h.isManual ? (
                          <span className="h-hours-badge" title={`${h.hours}h laborables`}>{h.hours}h</span>
                        ) : (
                          <ShieldCheck size={12} className="text-mint" />
                        )}
                        <span className="h-date">{format(parseISO(h.date), 'dd/MM/yy')}</span>
                      </div>
                      <span className="h-name">{h.name}</span>
                      {h.isManual && (
                        <button onClick={() => removeHoliday(h.date)} className="h-del" title="Eliminar feriado">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                {allHolidays.filter(h => h.date >= format(new Date(), 'yyyy-MM-dd')).length === 0 && (
                  <div className="empty-holidays" style={{textAlign: 'center', padding: '20px', opacity: 0.5, fontSize: '0.8rem'}}>No hay feriados próximos</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Visualización y Dashboard */}
        <div className="tracking-main">
          {/* Tarjeta Hero Consolidada: Meta vs Proyectada */}
          <div className="glass-card original-hero-card meta-hero relative overflow-hidden">
            {/* Botón de Finalización como Acción Principal */}
            <div className="absolute top-6 right-6 z-10">
              {project.status === 'completed' ? (
                <div className="status-badge-completed">
                  <CheckCircle size={14} /> PROYECTO COMPLETADO
                </div>
              ) : (
                <button
                  onClick={handleFinalizeProject}
                  disabled={totalProgress < 100 || isSaving}
                  className={`finalize-master-btn ${totalProgress === 100 ? 'ready' : 'waiting'}`}
                >
                  {isSaving ? 'Guardando...' : 'Finalizar Proyecto'}
                </button>
              )}
            </div>

            <div className="flex flex-col md:flex-row justify-between gap-6">
              
              {/* Lado Izquierdo: Plan Ideal */}
              <div className="flex-1">
                <div className="hero-header-flex mb-2 opacity-80">
                  <CheckCircle size={18} className="text-mint" />
                  <span className="hero-label uppercase tracking-wider text-sm">Fecha Meta (Plan Ideal)</span>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  {idealEndDate ? format(idealEndDate, "d 'de' MMMM, yyyy", { locale: es }) : "Define inicio"}
                </h2>
                <div className="flex align-center gap-6 text-sm opacity-60">
                  <div className="flex align-center gap-2">
                    <Clock size={14} />
                    <span>{totalHours}h estimadas</span>
                  </div>
                  <div className="flex align-center gap-2">
                    <TrendingUp size={14} className="text-mint" />
                    <span>{trackingMode === 'linear' ? 'Secuencial' : 'Paralelo'}</span>
                  </div>
                </div>
              </div>

              {/* Lado Derecho: Avance Real / Proyección */}
              <div className="flex-1 md:border-l md:border-white/10 md:pl-6">
                <div className="hero-header-flex mb-2 opacity-80 justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Activity size={18} className="text-blue-400" />
                    <span className="hero-label uppercase tracking-wider text-sm">Entrega Proyectada (Real)</span>
                  </div>
                  
                  {(() => {
                    const metaDiff = projectedEndDate && idealEndDate ? differenceInCalendarDays(projectedEndDate, idealEndDate) : 0;
                    const isAhead = metaDiff < 0;
                    const absDiff = Math.abs(metaDiff);
                    return (
                      <div className="flex align-center gap-2">
                        {metaDiff !== 0 && (
                          <span className={`status-badge-v4 ${isAhead ? 'ahead' : 'delayed'} px-2 py-0.5 rounded text-[10px] font-bold`}>
                            {isAhead ? 'Adelantado' : 'Retraso'} {isAhead ? '-' : '+'}{absDiff}d
                          </span>
                        )}
                        {metaDiff === 0 && <span className="status-badge-v4 ahead px-2 py-0.5 rounded text-[10px] font-bold">En Tiempo</span>}
                      </div>
                    );
                  })()}
                </div>
                <h2 className="text-3xl font-bold text-blue-300 mb-4">
                  {projectedEndDate ? format(projectedEndDate, "d 'de' MMMM, yyyy", { locale: es }) : "-"}
                </h2>
                <div className="progress-bar-v3 h-2 rounded bg-white/5 overflow-hidden">
                  <div className="progress-fill-v3 h-full bg-blue-500 transition-all duration-500" style={{ width: `${totalProgress}%` }}></div>
                </div>
                <div className="text-right mt-1 text-xs text-blue-300/60 font-medium">{totalProgress}% Completado</div>
              </div>

            </div>
          </div>

          <div className="tracking-panels-grid">
            <div className="glass-card gantt-preview-panel">
            <div 
              className="panel-header-v4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => setIsGanttCollapsed(!isGanttCollapsed)}
            >
              <div className="flex items-center gap-2">
                <Activity size={18} />
                <span>Simulación de Cronograma ({trackingMode === 'linear' ? 'Lineal' : 'Paralelo'})</span>
                {isGanttCollapsed ? <ChevronDown size={16} className="opacity-50 ml-2" /> : <ChevronUp size={16} className="opacity-50 ml-2" />}
              </div>
              <div className="text-xs text-warning flex items-center gap-1.5 bg-warning/10 px-3 py-1 rounded-full font-bold">
                <AlertCircle size={12} />
                Cálculo Inteligente Activado
              </div>
            </div>
            
            {!isGanttCollapsed && (
              <div className="gantt-scroll scroll-styled">
                <div className="gantt-container relative">
                
                {/* Switch Premium para Vistas y Zoom */}
                {(dualSchedule.ideal.length > 0 || dualSchedule.projected.length > 0) && (
                  <div className="flex justify-between items-center mb-6 px-4">
                    <div className="bg-black/30 p-1 rounded-xl flex shadow-inner border border-white/5">
                      <button 
                        onClick={() => setGanttView('ideal')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${ganttView === 'ideal' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                      >
                        Plan Ideal
                      </button>
                      <button 
                        onClick={() => setGanttView('projected')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-2 ${ganttView === 'projected' ? 'bg-mint/20 text-mint shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                      >
                        <Activity size={12} />
                        Ejecución Real
                      </button>
                    </div>
                  </div>
                )}

                {(() => {
                  const tasksToRender = ganttView === 'ideal' ? dualSchedule.ideal : dualSchedule.projected;
                  
                  if (tasksToRender.length === 0) return <p className="empty-msg p-20">Completa la estimación para ver la simulación.</p>;
                  
                  const CustomTooltip = ({ task }: { task: Task }) => {
                    return (
                      <div 
                        style={{ background: '#1c2541', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                        className="rounded-lg p-3 shadow-xl min-w-[180px] z-50"
                      >
                        <div className="font-bold text-sm mb-1">{task.name}</div>
                        <div className="text-xs opacity-60 mb-2">
                          {format(task.start, 'dd MMM yyyy')} - {format(task.end, 'dd MMM yyyy')}
                        </div>
                        <div className="progress-bar-v3 h-1.5 rounded bg-white/10 overflow-hidden mb-1">
                          <div className="progress-fill-v3 h-full transition-all" style={{ width: `${task.progress}%`, background: 'var(--color-accent-mint)' }}></div>
                        </div>
                        <div className="text-xs font-bold text-right" style={{ color: 'var(--color-accent-mint)' }}>
                          {task.progress}% completado
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="react-gantt-wrapper relative" style={{ overflow: 'hidden', width: '100%', borderRadius: '12px', background: '#1c2541' }}>
                      <style>{`
                        /* 1. Fondo Global del SVG */
                        .react-gantt-wrapper svg {
                          background: #1c2541 !important;
                        }
                        
                        /* 2. Forzar Transparencia en el Fondo y Cabeceras */
                        /* Hack: Como las clases están ofuscadas, hacemos transparentes todos los rectángulos */
                        /* EXCEPTO los que tienen bordes redondeados (rx), que son las barras de tareas */
                        /* Y EXCEPTO el marcador de 'hoy' que usa un fill específico */
                        .react-gantt-wrapper svg rect:not([rx]):not([fill="rgba(79, 209, 197, 0.1)"]) {
                          fill: transparent !important;
                        }
                        
                        /* 3. Color de las Líneas del Grid y Calendario */
                        .react-gantt-wrapper svg line,
                        .react-gantt-wrapper svg path:not([stroke-width="1.5"]) {
                          stroke: rgba(255,255,255,0.05) !important;
                        }
                        
                        /* 4. Color del Texto del Calendario (Fechas) */
                        .react-gantt-wrapper svg text {
                          fill: rgba(255,255,255,0.7) !important;
                          font-family: 'Outfit', sans-serif !important;
                          font-weight: 600 !important;
                        }
                        
                        /* 5. Estilos de las Dependencias (Flechas) */
                        .react-gantt-wrapper path[stroke-width="1.5"] { 
                          stroke: var(--color-accent-mint) !important; 
                        }
                        
                        /* 6. Ocultar Tooltip Nativo */
                        .react-gantt-wrapper [class*="tooltip"], ._2eZzQ { 
                          background: transparent !important; 
                          border: none !important; 
                          box-shadow: none !important; 
                        }
                      `}</style>
                      
                      {/* Controles de Zoom Flotantes */}
                      <div className="absolute top-4 right-4 z-10 bg-[#1c2541]/80 backdrop-blur-md p-1 rounded-xl flex shadow-xl border border-white/10">
                        <button onClick={() => setViewMode(ViewMode.Day)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === ViewMode.Day ? 'bg-mint/20 text-mint' : 'text-white/40 hover:text-white/70'}`}>Día</button>
                        <button onClick={() => setViewMode(ViewMode.Week)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === ViewMode.Week ? 'bg-mint/20 text-mint' : 'text-white/40 hover:text-white/70'}`}>Semana</button>
                        <button onClick={() => setViewMode(ViewMode.Month)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === ViewMode.Month ? 'bg-mint/20 text-mint' : 'text-white/40 hover:text-white/70'}`}>Mes</button>
                      </div>

                      <Gantt
                        tasks={tasksToRender}
                        viewMode={viewMode}
                        listCellWidth=""
                        TooltipContent={CustomTooltip as any}
                        columnWidth={viewMode === ViewMode.Month ? 200 : 60}
                        rowHeight={50}
                        fontSize="12"
                        barCornerRadius={6}
                        fontFamily="Outfit, sans-serif"
                        todayColor="rgba(79, 209, 197, 0.1)"
                        arrowColor="#4fd1c5"
                        arrowIndent={20}
                        locale="es"
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
            )}
          </div>

          <div className="glass-card task-tracking-panel">
            <div className="panel-header-v4">
              <TrendingUp size={18} />
              <span>Avance de Tareas</span>
            </div>
            <div className="task-tracking-list scroll-styled">
              {renderTrackingNode(null)}
            </div>
          </div>
          </div>
        </div>
      </div>

      <style>{`
        .tracking-wrapper { padding: 20px; }
        .tracking-layout { display: grid; grid-template-columns: 320px 1fr; gap: 24px; transition: all 0.4s ease; }
        .sidebar-collapsed .tracking-layout { grid-template-columns: 0px 1fr; gap: 0; }
        .sidebar-collapsed .tracking-sidebar { opacity: 0; pointer-events: none; transform: translateX(-30px); width: 0; overflow: hidden; padding: 0; border: none; }

        .tracking-sidebar { width: 320px; transition: all 0.4s ease; flex-shrink: 0; }
        .glass-card { background: rgba(28, 37, 65, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 24px; }
        .tracking-panels-grid { display: flex; flex-direction: column; gap: 24px; }
        .section-title { font-size: 1rem; color: white; display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .config-group { margin-bottom: 24px; }
        .config-label { display: block; font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; }
        
        .premium-date-input { width: 100%; background: rgba(0,0,0,0.2) !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 12px !important; color: white !important; padding: 12px !important; outline: none; }
        
        .finalize-master-btn {
          padding: 10px 20px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .finalize-master-btn.waiting {
          background: rgba(255,255,255,0.02);
          color: rgba(255,255,255,0.15);
          cursor: not-allowed;
          border-color: rgba(255,255,255,0.05);
        }

        .finalize-master-btn.ready {
          background: rgba(79, 209, 197, 0.1);
          color: var(--color-accent-mint);
          border-color: rgba(79, 209, 197, 0.5);
          box-shadow: 0 0 20px rgba(79, 209, 197, 0.05);
          cursor: pointer;
        }

        .finalize-master-btn.ready:hover {
          background: var(--color-accent-mint);
          color: #1c2541;
          box-shadow: 0 10px 30px rgba(79, 209, 197, 0.4);
          transform: translateY(-2px) scale(1.02);
        }

        .status-badge-completed {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(79, 209, 197, 0.15);
          color: var(--color-accent-mint);
          padding: 10px 20px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 800;
          border: 1px solid rgba(79, 209, 197, 0.3);
          box-shadow: inset 0 0 10px rgba(79, 209, 197, 0.1);
        }

        .mode-toggle-v4 { display: flex; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 14px; margin-bottom: 8px; }
        .mode-btn { flex: 1; padding: 8px; border: none; background: transparent; color: var(--color-text-secondary); font-size: 0.75rem; font-weight: 700; border-radius: 10px; cursor: pointer; transition: 0.2s; }
        .mode-btn.active { background: var(--color-accent-mint); color: var(--color-bg-primary); }
        .mode-helper { font-size: 0.65rem; color: var(--color-text-secondary); opacity: 0.6; font-style: italic; margin-left: 4px; }

        .day-scroll-v4 { overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; padding: 5px 0; user-select: none; white-space: nowrap; }
        .day-scroll-v4::-webkit-scrollbar { display: none; }
        .day-flex-v4 { display: flex; gap: 10px; min-width: max-content; }
        .day-btn-v4 { width: 54px; height: 54px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; color: var(--color-text-secondary); font-weight: 700; cursor: inherit; transition: 0.2s; }
        .day-btn-v4.active { background: var(--color-accent-mint); color: var(--color-bg-primary); border-color: var(--color-accent-mint); box-shadow: 0 4px 15px rgba(72, 229, 194, 0.3); }

        .holiday-input-stack-v4 { display: flex; flex-direction: column; gap: 12px; }
        .hours-selector-v4 { display: flex; gap: 8px; align-items: center; }
        .hour-chip-v4 { 
          flex: 1; padding: 10px 0; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
          border-radius: 10px; color: var(--color-text-secondary); font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: 0.2s;
        }
        .hour-chip-v4:hover { background: rgba(255,255,255,0.08); }
        .hour-chip-v4.active { background: rgba(72, 229, 194, 0.15); border-color: var(--color-accent-mint); color: var(--color-accent-mint); }

        .add-holiday-btn-v4 { width: 44px; height: 44px; background: var(--color-accent-mint); color: var(--color-bg-primary); border: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .add-holiday-btn-v4.large { width: 50px; height: 50px; border-radius: 14px; box-shadow: 0 4px 15px rgba(72, 229, 194, 0.2); }
        .add-holiday-btn-v4:hover { transform: scale(1.05); filter: brightness(1.1); }
        .glass-card .hours-helper-text { font-size: 0.65rem; color: var(--color-text-secondary); opacity: 0.5; margin: 8px 0 0 4px; font-style: italic; display: block; }
        .unified-list-v4 { max-height: 250px; overflow-y: auto; }
        .holiday-row-v4 { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .h-left { display: flex; align-items: center; gap: 10px; min-width: 95px; }
        .h-hours-badge { font-size: 0.65rem; background: rgba(72, 229, 194, 0.1); color: var(--color-accent-mint); padding: 2px 6px; border-radius: 4px; font-weight: 700; border: 1px solid rgba(72, 229, 194, 0.2); }
        .h-date { font-size: 0.8rem; font-weight: 800; color: white; }
        .h-name { font-size: 0.8rem; color: var(--color-text-secondary); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.6; padding-left: 10px; }
        .h-del { background: transparent; border: none; color: #ef476f; cursor: pointer; opacity: 0.5; }

        .original-hero-card { margin-bottom: 24px; border: 1px solid rgba(72, 229, 194, 0.15); }
        .hero-header-flex { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
        .hero-label { font-size: 0.9rem; color: var(--color-text-secondary); letter-spacing: 0.5px; }
        .hero-date-large { font-size: 2.5rem; font-weight: 800; color: white; margin-bottom: 20px; }
        .hero-footer-flex { display: flex; gap: 24px; font-size: 0.85rem; color: var(--color-text-secondary); }

        .tracking-grid-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        .stat-card-v3 { padding: 20px; }
        .stat-title { font-size: 0.85rem; color: var(--color-text-secondary); }
        .stat-value { font-size: 0.85rem; font-weight: 700; color: var(--color-accent-mint); }
        .stat-value.secondary { color: #ffb800; }
        .progress-bar-v3 { height: 8px; background: rgba(0,0,0,0.3); border-radius: 10px; overflow: hidden; }
        .progress-fill-v3 { height: 100%; background: var(--color-accent-mint); }
        .progress-fill-v3.secondary { background: #ffb800; }

        .info-card-v3 { display: flex; gap: 16px; align-items: flex-start; padding: 20px; background: rgba(255, 255, 255, 0.03); }
        .info-content { font-size: 0.85rem; line-height: 1.5; }
        .info-content p { margin: 0; }
        
        .flex { display: flex; }
        .align-center { align-items: center; }
        .gap-10 { gap: 10px; }
        .opacity-50 { opacity: 0.5; }
        .opacity-70 { opacity: 0.7; }
        .text-mint { color: var(--color-accent-mint); }
        .text-danger { color: #ef476f; }
        .text-warning { color: #ffb800; }
        
        .sync-btn-v4 { background: rgba(72, 229, 194, 0.1); border: 1px solid rgba(72, 229, 194, 0.2); color: var(--color-accent-mint); padding: 4px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 800; cursor: pointer; text-transform: uppercase; transition: 0.2s; }
        .sync-btn-v4:hover { background: var(--color-accent-mint); color: var(--color-bg-primary); }
        .no-margin { margin-bottom: 0 !important; }

        .diff-tag { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 800; }
        .diff-tag.late { background: rgba(239, 71, 111, 0.15); color: #ef476f; border: 1px solid rgba(239, 71, 111, 0.2); }
        .diff-tag.early { background: rgba(72, 229, 194, 0.15); color: var(--color-accent-mint); border: 1px solid rgba(72, 229, 194, 0.2); }

        .health-indicator-v4 { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; margin-top: 10px; font-weight: 600; }
        
        .task-tracking-panel { margin-top: 0px; padding: 0; overflow: hidden; display: flex; flex-direction: column; }
        .panel-header-v4 { padding: 15px 20px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 10px; font-weight: 600; }
        .task-tracking-list { max-height: 600px; overflow-y: auto; padding: 10px 0; }
        .tracking-parent-group { margin-bottom: 0px; }
        .parent-row { padding: 10px 20px; background: rgba(255,255,255,0.02); border-left: 2px solid var(--color-accent-mint); border-bottom: 1px solid rgba(255,255,255,0.05); }
        .leaf-row { border-bottom: 1px solid rgba(255,255,255,0.03); }
        .tracking-task-row { 
          display: flex; 
          align-items: center; 
          justify-content: flex-start; 
          padding: 10px 20px; 
          padding-left: calc(var(--depth, 0) * 24px + 20px);
          transition: 0.2s;
        }
        .parent-row .t-name { font-size: 0.85rem; font-weight: 800; color: var(--color-accent-mint); text-transform: uppercase; }
        .p-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent-mint); flex-shrink: 0; }
        .parent-progress-mini { width: 100px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
        .p-mini-fill { height: 100%; background: var(--color-accent-mint); opacity: 0.6; }
        
        .gantt-preview-panel { margin-top: 0px; padding: 0; overflow: hidden; display: flex; flex-direction: column; }
        .gantt-scroll { overflow-x: auto; overflow-y: auto; max-height: 600px; padding: 20px 0; }
        .gantt-container { min-height: 100px; padding: 0 20px; }
        .gantt-row { display: flex; align-items: center; gap: 20px; height: 32px; }
        .gantt-task-info { min-width: 150px; max-width: 150px; overflow: hidden; }
        .gantt-task-name { font-size: 0.7rem; color: var(--color-text-secondary); white-space: nowrap; text-overflow: ellipsis; }
        .gantt-track { flex: 1; height: 100%; background: rgba(255,255,255,0.02); border-radius: 4px; position: relative; }
        .gantt-bar { position: absolute; height: 20px; top: 6px; border-radius: 10px; display: flex; align-items: center; justify-content: center; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); z-index: 2; }
        .gantt-actual-bar { position: absolute; height: 8px; top: 12px; border-radius: 4px; z-index: 1; border: 1px solid rgba(255,255,255,0.1); }
        .gantt-bar-label { font-size: 0.55rem; color: var(--color-bg-primary); font-weight: 800; white-space: nowrap; }

        .tracking-task-row:hover { background: rgba(255,255,255,0.02); }
        .t-info { display: flex; flex-direction: column; gap: 2px; width: 350px; flex-shrink: 0; }
        .t-name { font-size: 0.9rem; font-weight: 600; color: white; }
        .t-meta { font-size: 0.7rem; color: var(--color-text-secondary); opacity: 0.6; }
        .t-action { display: flex; align-items: center; justify-content: flex-start; gap: 15px; flex: 1; max-width: 250px; }
        .t-pct { font-size: 0.85rem; font-family: monospace; color: var(--color-accent-mint); width: 40px; text-align: right; font-weight: bold; }
        
        .tracking-task-row.blocked { opacity: 0.5; filter: grayscale(0.5); }
        .blocked-tag { font-size: 0.6rem; background: rgba(239, 71, 111, 0.2); color: #ef476f; padding: 1px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase; }
        .font-bold { font-weight: 700; }

        .progress-slider-v4 {
          -webkit-appearance: none;
          width: 100%;
          height: 4px;
          border-radius: 5px;
          background: rgba(255,255,255,0.1);
          outline: none;
        }
        .progress-slider-v4::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--color-accent-mint);
          cursor: pointer;
          border: 2px solid var(--color-bg-primary);
        }

        .scroll-styled::-webkit-scrollbar { width: 3px; }
        .scroll-styled::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .saving-tag { font-size: 0.65rem; color: #ffb800; background: rgba(255, 184, 0, 0.1); padding: 4px 8px; border-radius: 20px; font-weight: 700; }
        .saved-tag { font-size: 0.65rem; color: var(--color-accent-mint); background: rgba(72, 229, 194, 0.1); padding: 4px 8px; border-radius: 20px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>
    </div>
  );
}
