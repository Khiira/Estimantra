import { useState, useEffect, useMemo, useRef } from 'react';
import { insforge } from '../lib/insforge';
import { Calendar, Clock, CheckCircle, AlertCircle, Plus, Trash2, TrendingUp, ShieldCheck, Activity } from 'lucide-react';
import { format, addDays, parseISO, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [trackingMode, setTrackingMode] = useState<'linear' | 'parallel'>(project.tracking_mode || 'linear');
  const [targetDate, setTargetDate] = useState(project.target_delivery_date || '');
  const [localTasks, setLocalTasks] = useState<any[]>(tasks);

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
    fetchTeamMembers();
    if (!project.auto_holidays || project.auto_holidays.length === 0) {
      fetchAutoHolidays();
    } else {
      setAutoHolidays(project.auto_holidays);
    }
  }, [project.id]);

  const fetchTeamMembers = async () => {
    const { data } = await insforge.database
      .from('team_members')
      .select('*')
      .eq('project_id', project.id);
    setTeamMembers(data || []);
  };

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
  };

  const calculateEndDate = (useRemaining = true) => {
    if (!startDate || tasks.length === 0) return null;
    
    const workingDaysList = Array.isArray(project?.working_days) ? project.working_days.map(Number) : [1, 2, 3, 4, 5];
    const startDateObj = startDate ? (startDate.includes('-') ? parseISO(startDate) : new Date()) : new Date();
    startDateObj.setHours(12, 0, 0, 0);

    const leafTasks = tasks.filter(t => !tasks.some(child => child.parent_id === t.id));
    const hours = leafTasks.reduce((acc, t) => {
      const estimated = Number(t.estimated_hours || 0);
      return acc + (useRemaining ? estimated * (1 - (Number(t.progress || 0) / 100)) : estimated);
    }, 0);

    if (hours <= 0) return startDateObj;

    const hoursPerDay = project.hours_per_day || 8;
    let remaining = hours;
    let iterations = 0;
    let current = new Date(startDateObj);

    while (remaining > 0 && iterations < 1000) {
      iterations++;
      const dateStr = format(current, 'yyyy-MM-dd');
      const isWorkingDay = workingDaysList.includes(current.getDay());
      const specialDay = (allHolidays || []).find(h => h.date === dateStr);
      
      if (isWorkingDay) {
        remaining -= specialDay ? Number(specialDay.hours || 0) : hoursPerDay;
      }
      if (remaining > 0) current = addDays(current, 1);
    }
    return current;
  };

  const calculateParallelEndDate = () => {
    if (!startDate || tasks.length === 0) return null;

    const [year, month, day] = startDate.split('-').map(Number);
    let current = new Date(year, month - 1, day, 12, 0, 0);

    const hoursPerDay = project.hours_per_day || 8;
    
    // Filtrar solo tareas hoja que tengan horas y no estén terminadas
    let pendingTasks = tasks
      .filter(t => !tasks.some(child => child.parent_id === t.id) && (Number(t.estimated_hours) > 0))
      .map(t => ({ ...t, remaining: Number(t.estimated_hours) * (1 - (Number(t.progress || 0) / 100)) }))
      .filter(t => t.remaining > 0);

    if (pendingTasks.length === 0) return new Date();

    // Capacidad por rol basada en el equipo
    const capacityByRole: Record<string, number> = {};
    teamMembers.forEach(m => {
      if (m.role_id) {
        capacityByRole[m.role_id] = (capacityByRole[m.role_id] || 0) + 1;
      }
    });

    let iterations = 0;
    while (pendingTasks.length > 0 && iterations < 1000) {
      iterations++;
      const dayOfWeek = current.getDay();
      const dateStr = format(current, 'yyyy-MM-dd');
      const isWorkingDay = workingDays.map(Number).includes(dayOfWeek);
      const specialDay = allHolidays.find(h => h.date === dateStr);

      if (isWorkingDay) {
        const dailyAvailableHours = specialDay ? Number(specialDay.hours || 0) : hoursPerDay;

        if (dailyAvailableHours > 0) {
          // 1. Identificar tareas listas (sin dependencias pendientes)
          const readyTasks = pendingTasks.filter(t => 
            !t.predecessor_id || !pendingTasks.some(p => p.id === t.predecessor_id)
          );

          // 2. Asignar recursos y restar horas
          const usedCapacity: Record<string, number> = {};
          
          for (const task of readyTasks) {
            const roleId = task.assigned_role_id || 'unassigned';
            const capacity = capacityByRole[roleId] || 1; // Por defecto 1 si no hay equipo definido o es genérico
            
            if ((usedCapacity[roleId] || 0) < capacity) {
              const reduction = Math.min(task.remaining, dailyAvailableHours);
              task.remaining -= reduction;
              usedCapacity[roleId] = (usedCapacity[roleId] || 0) + 1;
            }
          }

          // 3. Limpiar tareas terminadas
          pendingTasks = pendingTasks.filter(t => t.remaining > 0);
        }
      }

      if (pendingTasks.length > 0) {
        current = addDays(current, 1);
      }
    }

    return current;
  };

  // Fecha de Entrega si todo va perfecto (basado en estimaciones totales)
  const idealEndDate = calculateEndDate(false);
  
  // Fecha de Entrega proyectada según el avance actual
  const projectedEndDate = calculateEndDate(true);

  const simulationSchedule = useMemo(() => {
    if (!startDate || tasks.length === 0) return [];
    let iterations = 0;
    const hoursPerDay = project.hours_per_day || 8;

    const workingDaysList = Array.isArray(project?.working_days) ? project.working_days.map(Number) : [1, 2, 3, 4, 5];
    const startDateObj = startDate ? (startDate.includes('-') ? parseISO(startDate) : new Date()) : new Date();
    startDateObj.setHours(12, 0, 0, 0);
    let current = new Date(startDateObj);

    let pendingTasks = tasks
      .filter(t => !tasks.some(child => child.parent_id === t.id) && (Number(t.estimated_hours) > 0))
      .map(t => ({ ...t, remaining: Number(t.estimated_hours) }));
    
    // Incluir tareas al 100% solo para el histórico del gráfico
    const schedule: any[] = [];
    tasks.filter(t => !tasks.some(child => child.parent_id === t.id) && Number(t.progress) === 100).forEach(t => {
      const sDate = t.actual_start_date ? parseISO(t.actual_start_date) : parseISO(startDate);
      const eDate = t.actual_end_date ? parseISO(t.actual_end_date) : sDate;
      schedule.push({
        id: t.id,
        name: t.task_name,
        start: format(sDate, 'yyyy-MM-dd'),
        startIndex: 0,
        end: format(eDate, 'yyyy-MM-dd'),
        endIndex: 0,
        roleId: t.assigned_role_id,
        color: roles.find((r: any) => r.id === t.assigned_role_id)?.color_hex || '#444',
        progress: 100,
        isPast: true
      });
    });

    const capacityByRole: Record<string, number> = {};
    teamMembers.forEach(m => {
      if (m.role_id) capacityByRole[m.role_id] = (capacityByRole[m.role_id] || 0) + 1;
    });

    while (pendingTasks.some(t => t.remaining > 0) && iterations < 1000) {
      iterations++;
      const dateStr = format(current, 'yyyy-MM-dd');
      const isWorkingDay = workingDaysList.includes(current.getDay());
      const specialDay = (allHolidays || []).find(h => h.date === dateStr);
      
      if (isWorkingDay) {
        const dailyLimit = specialDay ? Number(specialDay.hours || 0) : hoursPerDay;
        
        if (dailyLimit > 0) {
          // Seguimiento de horas disponibles este día
          let globalRemaining = dailyLimit; // Para modo lineal
          const roleRemaining: Record<string, number> = {}; // Para modo paralelo
          Object.keys(capacityByRole).forEach(rId => {
            roleRemaining[rId] = capacityByRole[rId] * dailyLimit;
          });
          const unassignedRemaining = (teamMembers.length || 1) * dailyLimit;

          while ((trackingMode === 'linear' ? globalRemaining > 0 : true) && pendingTasks.some(t => t.remaining > 0)) {
            // Identificar tareas listas (sin predecesores pendientes)
            const readyTasks = pendingTasks.filter(t => {
              if (t.remaining <= 0) return false;
              if (!t.predecessor_id) return true;
              const pred = tasks.find(p => p.id === t.predecessor_id);
              return pred && Number(pred.progress) === 100 && !pendingTasks.some(p => p.id === t.predecessor_id && p.remaining > 0);
            });

            if (readyTasks.length === 0) break; // Bloqueo por dependencias

            let taskStartedInLoop = false;
            for (const task of readyTasks) {
              const rId = task.assigned_role_id;
              let available = 0;
              
              if (trackingMode === 'linear') {
                available = globalRemaining;
              } else {
                available = rId ? (roleRemaining[rId] || dailyLimit) : unassignedRemaining;
              }

              if (available > 0) {
                const reduction = Math.min(task.remaining, available);
                task.remaining -= reduction;
                taskStartedInLoop = true;

                if (trackingMode === 'linear') {
                  globalRemaining -= reduction;
                } else {
                  if (rId) roleRemaining[rId] -= reduction;
                }

                let entry = schedule.find(s => s.id === task.id);
                if (!entry) {
                  entry = {
                    id: task.id,
                    name: task.task_name,
                    start: dateStr,
                    startIndex: iterations,
                    end: dateStr,
                    endIndex: iterations,
                    roleId: task.assigned_role_id,
                    color: roles.find((r: any) => r.id === task.assigned_role_id)?.color_hex || 'var(--color-accent-mint)',
                    progress: task.progress || 0
                  };
                  schedule.push(entry);
                }
                entry.end = dateStr;
                entry.endIndex = iterations;

                if (trackingMode === 'linear' && globalRemaining <= 0) break;
              }
            }
            if (!taskStartedInLoop) break;
          }
        }
      }
      current = addDays(current, 1);
    }
    return schedule;
  }, [startDate, tasks, roles, teamMembers, project.working_days, allHolidays, trackingMode, project.hours_per_day]);

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
                              {task.actual_start_date && ` • Iniciado: ${format(parseISO(task.actual_start_date), 'dd/MM')}`}
                              {task.actual_end_date && ` • Fin: ${format(parseISO(task.actual_end_date), 'dd/MM')}`}
                            </span>
                          </div>
                          <div className="t-action">
                            {isLeaf ? (
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
                                  if (val > 0 && !oldTask?.actual_start_date) {
                                    updates.actual_start_date = new Date().toISOString();
                                  }
                                  if (val === 100 && !oldTask?.actual_end_date) {
                                    updates.actual_end_date = new Date().toISOString();
                                  }

                                  await insforge.database.from('tasks').update(updates).eq('id', task.id);
                                }}
                                className="progress-slider-v4"
                              />
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
    const leafTasks = tasks.filter(t => !tasks.some(child => child.parent_id === t.id));
    if (leafTasks.length === 0) return 0;
    const weightedSum = leafTasks.reduce((acc, t) => acc + (Number(t.progress || 0) * Number(t.estimated_hours || 0)), 0);
    const totalEstHours = leafTasks.reduce((acc, t) => acc + Number(t.estimated_hours || 0), 0);
    return totalEstHours > 0 ? Math.round(weightedSum / totalEstHours) : 0;
  }, [tasks]);

  const projectStatus = useMemo(() => {
    if (!endDate || !targetDate) return { label: 'Sin objetivo', color: 'text-mint', icon: <CheckCircle size={14} />, diff: 0 };
    const endStr = format(endDate, 'yyyy-MM-dd');
    
    // Calcular diferencia en días
    const targetObj = parseISO(targetDate);
    const diffTime = endDate.getTime() - targetObj.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (endStr <= targetDate) return { label: 'A tiempo', color: 'text-mint', icon: <CheckCircle size={14} />, diff: diffDays };
    return { label: 'Con Retraso', color: 'text-danger', icon: <AlertCircle size={14} />, diff: diffDays };
  }, [endDate, targetDate]);

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
          {/* Tarjeta Hero: Meta Ideal */}
          <div className="glass-card original-hero-card meta-hero">
            <div className="hero-header-flex">
              <CheckCircle size={20} className="text-mint" />
              <span className="hero-label">Fecha Meta (Plan Ideal)</span>
            </div>
            <h2 className="hero-date-large">
              {idealEndDate ? format(idealEndDate, "d 'de' MMMM, yyyy", { locale: es }) : "Define inicio"}
            </h2>
            <div className="hero-footer-flex">
              <div className="flex align-center gap-10">
                <Clock size={14} className="opacity-50" />
                <span>{totalHours}h totales estimadas</span>
              </div>
              <div className="flex align-center gap-10">
                <TrendingUp size={14} className="text-mint" />
                <span>Modo: {trackingMode === 'linear' ? 'Secuencial' : 'Paralelo'}</span>
              </div>
            </div>
          </div>

          <div className="tracking-grid-stats">
            <div className="glass-card stat-card-v3">
              <div className="flex-between margin-bottom-10">
                <span className="stat-title">Progreso del Proyecto</span>
                <span className="stat-value">{totalProgress}%</span>
              </div>
              <div className="progress-bar-v3">
                <div className="progress-fill-v3" style={{ width: `${totalProgress}%` }}></div>
              </div>
            </div>

            <div className="glass-card stat-card-v3">
              <div className="flex-between margin-bottom-10">
                <span className="stat-title">Entrega Proyectada (Avance Real)</span>
                {(() => {
                  const metaDiff = projectedEndDate && idealEndDate ? differenceInCalendarDays(projectedEndDate, idealEndDate) : 0;
                  const isDelayed = metaDiff > 0;
                  const isAhead = metaDiff < 0;
                  const absDiff = Math.abs(metaDiff);
                  return (
                    <div className="flex align-center gap-10">
                      <span className="s-value">{isAhead ? 'Adelantado' : isDelayed ? 'Con Retraso' : 'En Tiempo'}</span>
                      {metaDiff !== 0 && (
                        <span className={`status-badge-v4 ${isAhead ? 'ahead' : 'delayed'}`}>
                          {isAhead ? '-' : '+'}{absDiff}d
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="health-indicator-v4">
                <div className="flex flex-column">
                  <span className="projected-date-small">
                    {projectedEndDate ? format(projectedEndDate, 'dd MMM, yyyy', { locale: es }) : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card gantt-preview-panel">
            <div className="panel-header-v4">
              <Activity size={18} />
              <span>Simulación de Cronograma ({trackingMode === 'linear' ? 'Lineal' : 'Paralelo'})</span>
            </div>
            <div className="gantt-scroll scroll-styled">
              <div className="gantt-container" style={{ width: `${Math.max(800, (simulationSchedule.filter(s => !s.isPast).pop()?.endIndex || 1) * 40 + 200)}px` }}>
                {simulationSchedule.map((item) => (
                  <div key={item.id} className="gantt-row">
                    <div className="gantt-task-info">
                      <span className="gantt-task-name">{item.name}</span>
                    </div>
                    <div className="gantt-track">
                      {item.isPast ? (
                        <div 
                          className="gantt-bar past" 
                          style={{ 
                            left: '0', 
                            width: '40px',
                            background: '#444'
                          }}
                        >
                          <CheckCircle size={10} />
                        </div>
                      ) : (
                        <div 
                          className="gantt-bar" 
                          style={{ 
                            left: `${(item.startIndex - 1) * 40}px`, 
                            width: `${Math.max(30, (item.endIndex - item.startIndex + 1) * 40)}px`,
                            background: item.color,
                            boxShadow: `0 0 10px ${item.color}44`
                          }}
                        >
                          <span className="gantt-bar-label">{format(parseISO(item.start), 'dd MMM')}</span>
                        </div>
                      )}
                      {!item.isPast && item.progress > 0 && (
                        <div 
                          className="gantt-actual-bar" 
                          style={{ 
                            left: `${(item.startIndex - 1) * 40}px`, 
                            width: `${((item.endIndex - item.startIndex + 1) * 40) * (item.progress / 100)}px`,
                            background: 'rgba(255,255,255,0.5)'
                          }}
                        ></div>
                      )}
                    </div>
                  </div>
                ))}
                {simulationSchedule.length === 0 && <p className="empty-msg p-20">Completa la estimación para ver la simulación.</p>}
              </div>
            </div>
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

          <div className="glass-card info-card-v3">
            <AlertCircle size={18} className="text-warning" />
            <div className="info-content">
              <p><strong>Cálculo Inteligente Activado</strong></p>
              <p className="opacity-70">El sistema ajusta la fecha considerando feriados nacionales, jornadas parciales manuales y días no laborables configurados.</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .tracking-wrapper { padding: 20px; }
        .tracking-layout { display: grid; grid-template-columns: 320px 1fr; gap: 24px; transition: all 0.4s ease; }
        .sidebar-collapsed .tracking-layout { grid-template-columns: 0px 1fr; gap: 0; }
        .sidebar-collapsed .tracking-sidebar { opacity: 0; pointer-events: none; transform: translateX(-30px); width: 0; overflow: hidden; padding: 0; border: none; }

        .tracking-sidebar { width: 320px; transition: all 0.4s ease; }
        .glass-card { background: rgba(28, 37, 65, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 24px; }
        .section-title { font-size: 1rem; color: white; display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .config-group { margin-bottom: 24px; }
        .config-label { display: block; font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; }
        
        .premium-date-input { width: 100%; background: rgba(0,0,0,0.2) !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 12px !important; color: white !important; padding: 12px !important; outline: none; }
        
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
        
        .task-tracking-panel { margin-top: 24px; padding: 0; overflow: hidden; }
        .panel-header-v4 { padding: 15px 20px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 10px; font-weight: 600; }
        .task-tracking-list { max-height: 400px; overflow-y: auto; padding: 10px 0; }
        .tracking-parent-group { margin-bottom: 0px; }
        .parent-row { padding: 10px 20px; background: rgba(255,255,255,0.02); border-left: 2px solid var(--color-accent-mint); border-bottom: 1px solid rgba(255,255,255,0.05); }
        .leaf-row { border-bottom: 1px solid rgba(255,255,255,0.03); }
        .tracking-task-row { 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          padding: 10px 20px; 
          padding-left: calc(var(--depth, 0) * 24px + 20px);
          transition: 0.2s;
        }
        .parent-row .t-name { font-size: 0.85rem; font-weight: 800; color: var(--color-accent-mint); text-transform: uppercase; }
        .p-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent-mint); }
        .parent-progress-mini { width: 100px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
        .p-mini-fill { height: 100%; background: var(--color-accent-mint); opacity: 0.6; }
        
        .gantt-preview-panel { margin-top: 24px; padding: 0; overflow: hidden; }
        .gantt-scroll { overflow-x: auto; padding: 20px 0; }
        .gantt-container { min-height: 100px; display: flex; flex-direction: column; gap: 8px; padding: 0 20px; }
        .gantt-row { display: flex; align-items: center; gap: 20px; height: 32px; }
        .gantt-task-info { min-width: 150px; max-width: 150px; overflow: hidden; }
        .gantt-task-name { font-size: 0.7rem; color: var(--color-text-secondary); white-space: nowrap; text-overflow: ellipsis; }
        .gantt-track { flex: 1; height: 100%; background: rgba(255,255,255,0.02); border-radius: 4px; position: relative; }
        .gantt-bar { position: absolute; height: 20px; top: 6px; border-radius: 10px; display: flex; align-items: center; justify-content: center; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); z-index: 2; }
        .gantt-actual-bar { position: absolute; height: 8px; top: 12px; border-radius: 4px; z-index: 1; border: 1px solid rgba(255,255,255,0.1); }
        .gantt-bar-label { font-size: 0.55rem; color: var(--color-bg-primary); font-weight: 800; white-space: nowrap; }

        .tracking-task-row:hover { background: rgba(255,255,255,0.02); }
        .t-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .t-name { font-size: 0.9rem; font-weight: 600; color: white; }
        .t-meta { font-size: 0.7rem; color: var(--color-text-secondary); opacity: 0.6; }
        .t-action { display: flex; align-items: center; gap: 15px; min-width: 200px; }
        .t-pct { font-size: 0.85rem; font-family: monospace; color: var(--color-accent-mint); width: 40px; text-align: right; }
        
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
