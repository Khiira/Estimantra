import { useState, useEffect, useMemo, useRef } from 'react';
import { insforge } from '../lib/insforge';
import { Calendar, Clock, CheckCircle, AlertCircle, Plus, Trash2, TrendingUp, DollarSign, ShieldCheck, Info } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface ProjectTrackingProps {
  project: any;
  tasks: any[];
  onProjectUpdate: (updatedProject: any) => void;
  isSidebarOpen?: boolean;
}

export default function ProjectTracking({ project, tasks, onProjectUpdate, isSidebarOpen = true }: ProjectTrackingProps) {
  const [startDate, setStartDate] = useState(project.start_date || '');
  const [workingDays, setWorkingDays] = useState<number[]>(project.working_days || [1, 2, 3, 4, 5]);
  const [holidays, setHolidays] = useState<string[]>(project.holidays || []);
  const [autoHolidays, setAutoHolidays] = useState<{date: string, name: string}[]>([]);
  const [newHoliday, setNewHoliday] = useState('');
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
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
  }, [project.id]);

  useEffect(() => {
    // Solo buscamos de la API si no hay feriados automáticos guardados
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
      // Guardar en BD para persistencia del proyecto
      handleUpdateConfig({ auto_holidays: holidayData });
    } catch (err) {
      console.error("Error cargando feriados:", err);
    } finally {
      setLoadingHolidays(false);
    }
  };

  const allHolidays = useMemo(() => {
    const manual = holidays.map(h => ({ date: h, name: 'Manual', isManual: true }));
    const auto = autoHolidays.map(h => ({ date: h.date, name: h.name, isManual: false }));
    return [...manual, ...auto].sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, autoHolidays]);

  const totalHours = tasks.reduce((acc, t) => acc + (Number(t.estimated_hours) || 0), 0);
  
  const daysOfWeek = [
    { id: 1, name: 'Lun' },
    { id: 2, name: 'Mar' },
    { id: 3, name: 'Mié' },
    { id: 4, name: 'Jue' },
    { id: 5, name: 'Vie' },
    { id: 6, name: 'Sáb' },
    { id: 0, name: 'Dom' },
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
    // Delay para feedback visual
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
    if (!newHoliday || holidays.includes(newHoliday)) return;
    const newHolidays = [...holidays, newHoliday];
    setHolidays(newHolidays);
    handleUpdateConfig({ holidays: newHolidays });
    setNewHoliday('');
  };

  const removeHoliday = (h: string) => {
    const newHolidays = holidays.filter(date => date !== h);
    setHolidays(newHolidays);
    handleUpdateConfig({ holidays: newHolidays });
  };

  const calculateEndDate = () => {
    if (!startDate || totalHours === 0) return null;
    
    // Parsear la fecha asegurando que sea mediodía local para evitar desfases de zona horaria
    const [year, month, day] = startDate.split('-').map(Number);
    let current = new Date(year, month - 1, day, 12, 0, 0);
    
    let remainingHours = totalHours;
    const hoursPerDay = project.hours_per_day || 8;
    const holidayDates = allHolidays.map(h => h.date);

    let iterations = 0;
    // Máximo 2 años de iteración para evitar bucles infinitos
    while (remainingHours > 0 && iterations < 730) {
      iterations++;
      const dayOfWeek = current.getDay();
      const dateStr = format(current, 'yyyy-MM-dd');
      
      // Aseguramos que comparamos números
      const isWorkingDay = workingDays.map(Number).includes(dayOfWeek);
      const isHoliday = holidayDates.includes(dateStr);

      if (isWorkingDay && !isHoliday) {
        remainingHours -= hoursPerDay;
      }
      
      if (remainingHours > 0) {
        current = addDays(current, 1);
      }
    }
    return current;
  };

  // Lógica de arrastre para el scroll
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
    const walk = (x - startX) * 2; // Velocidad de scroll
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const endDate = calculateEndDate();

  return (
    <div className="tracking-wrapper animate-fade-in">
      <div className={`tracking-layout ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
        
        {/* Lado Izquierdo: Configuración */}
        <div className="tracking-sidebar">
          <div className="glass-card tracking-config-panel">
            <div className="flex-between margin-bottom-20">
              <h3 className="section-title" style={{marginBottom: 0}}><Calendar size={18} className="text-mint" /> Planificación</h3>
              {isSaving ? (
                <span className="saving-tag animate-pulse">Sincronizando...</span>
              ) : (
                <span className="saved-tag"><CheckCircle size={12} /> Guardado</span>
              )}
            </div>
            
            <div className="config-group">
              <label className="config-label">Fecha de Inicio</label>
              <input 
                type="date" 
                className="premium-date-input"
                value={startDate} 
                onChange={(e) => {
                  setStartDate(e.target.value);
                  handleUpdateConfig({ start_date: e.target.value });
                }}
              />
            </div>

            <div className="config-group">
              <label className="config-label">Jornada Laboral (Arrastra)</label>
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
                      onClick={() => !isDragging && toggleDay(day.id)}
                    >
                      {day.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="config-group">
              <label className="config-label">Feriados (API + Manual)</label>
              <div className="holiday-input-row-v4">
                <input 
                  type="date" 
                  className="premium-date-input compact"
                  value={newHoliday} 
                  onChange={(e) => setNewHoliday(e.target.value)}
                />
                <button className="add-holiday-btn-v4" onClick={addHoliday}>
                  <Plus size={20} />
                </button>
              </div>
              
              <div className="unified-list-v4 scroll-styled">
                {loadingHolidays && <p className="loading-small">Sincronizando feriados...</p>}
                {allHolidays.map((h, i) => (
                  <div key={i} className={`holiday-row-v4 ${h.isManual ? 'manual' : 'auto'}`}>
                    <div className="h-left">
                      {h.isManual ? <Info size={12} className="text-danger" /> : <ShieldCheck size={12} className="text-mint" />}
                      <span className="h-date">{format(parseISO(h.date), 'dd/MM/yy')}</span>
                    </div>
                    <span className="h-name">{h.isManual ? 'Manual' : h.name}</span>
                    {h.isManual && (
                      <button onClick={() => removeHoliday(h.date)} className="h-del"><Trash2 size={12} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Visualización y Dashboard */}
        <div className="tracking-main">
          {/* Tarjeta de Fecha Estimada */}
          <div className="glass-card original-hero-card">
            <div className="hero-header-flex">
              <TrendingUp size={20} className="text-mint" />
              <span className="hero-label">Entrega Estimada</span>
            </div>
            <h2 className="hero-date-large">
              {endDate ? format(endDate, "d 'de' MMMM, yyyy", { locale: es }) : "Define inicio"}
            </h2>
            <div className="hero-footer-flex">
              <div className="flex align-center gap-10">
                <Clock size={14} className="opacity-50" />
                <span>{totalHours}h totales</span>
              </div>
              <div className="flex align-center gap-10">
                <ShieldCheck size={14} className="text-mint" />
                <span>{autoHolidays.length} Feriados Guardados</span>
              </div>
            </div>
          </div>

          <div className="tracking-grid-stats">
            <div className="glass-card stat-card-v3">
              <div className="flex-between margin-bottom-10">
                <span className="stat-title">Esfuerzo Ejecutado</span>
                <span className="stat-value">0%</span>
              </div>
              <div className="progress-bar-v3">
                <div className="progress-fill-v3" style={{ width: '0%' }}></div>
              </div>
            </div>

            <div className="glass-card stat-card-v3">
              <div className="flex-between margin-bottom-10">
                <span className="stat-title">Presupuesto Consumido</span>
                <span className="stat-value secondary">0%</span>
              </div>
              <div className="progress-bar-v3">
                <div className="progress-fill-v3 secondary" style={{ width: '0%' }}></div>
              </div>
            </div>
          </div>

          <div className="glass-card info-card-v3">
            <AlertCircle size={18} className="text-warning" />
            <div className="info-content">
              <p><strong>Persistencia Activada</strong></p>
              <p className="opacity-70">Los feriados detectados se han guardado en el proyecto. No se perderán aunque cierres la sesión o cambies de dispositivo.</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .tracking-wrapper { padding: 20px; }
        .tracking-layout { display: grid; grid-template-columns: 320px 1fr; gap: 24px; transition: all 0.4s ease; }
        .tracking-layout.sidebar-collapsed { grid-template-columns: 0px 1fr; }
        .tracking-layout.sidebar-collapsed .tracking-sidebar { opacity: 0; pointer-events: none; transform: translateX(-30px); }

        .tracking-sidebar { width: 320px; transition: all 0.4s ease; }
        .glass-card { background: rgba(28, 37, 65, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 24px; }
        .section-title { font-size: 1rem; color: white; display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .config-group { margin-bottom: 24px; }
        .config-label { display: block; font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; }
        
        .premium-date-input { width: 100%; background: rgba(0,0,0,0.2) !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 12px !important; color: white !important; padding: 12px !important; outline: none; }
        
        /* Jornada con Arrastre (Drag) */
        .day-scroll-v4 { 
          overflow-x: auto; 
          scrollbar-width: none; 
          -ms-overflow-style: none; 
          padding: 5px 0;
          user-select: none;
          white-space: nowrap;
        }
        .day-scroll-v4::-webkit-scrollbar { display: none; }
        .day-flex-v4 { display: flex; gap: 10px; min-width: max-content; }
        .day-btn-v4 { 
          width: 54px; height: 54px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; 
          color: var(--color-text-secondary); font-weight: 700; cursor: inherit; transition: 0.2s;
        }
        .day-btn-v4.active { background: var(--color-accent-mint); color: var(--color-bg-primary); border-color: var(--color-accent-mint); box-shadow: 0 4px 15px rgba(72, 229, 194, 0.3); }

        /* Feriados Layout */
        .holiday-input-row-v4 { display: flex; gap: 8px; margin-bottom: 15px; }
        .add-holiday-btn-v4 { 
          width: 44px; height: 44px; background: var(--color-accent-mint); color: var(--color-bg-primary); 
          border: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; 
        }
        .unified-list-v4 { max-height: 300px; overflow-y: auto; }
        .holiday-row-v4 { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .h-left { display: flex; align-items: center; gap: 10px; min-width: 85px; }
        .h-date { font-size: 0.8rem; font-weight: 800; color: white; }
        .h-name { font-size: 0.8rem; color: var(--color-text-secondary); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.6; }
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
        .scroll-styled::-webkit-scrollbar { width: 3px; }
        .scroll-styled::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

        .saving-tag { font-size: 0.65rem; color: #ffb800; background: rgba(255, 184, 0, 0.1); padding: 4px 8px; border-radius: 20px; font-weight: 700; }
        .saved-tag { font-size: 0.65rem; color: var(--color-accent-mint); background: rgba(72, 229, 194, 0.1); padding: 4px 8px; border-radius: 20px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>
    </div>
  );
}
