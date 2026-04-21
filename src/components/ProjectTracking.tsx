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
  const [holidays, setHolidays] = useState<any[]>(project.holidays || []);
  const [autoHolidays, setAutoHolidays] = useState<{date: string, name: string}[]>([]);
  const [newHoliday, setNewHoliday] = useState('');
  const [newHolidayHours, setNewHolidayHours] = useState('0');
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

  const calculateEndDate = () => {
    if (!startDate || totalHours === 0) return null;
    
    const [year, month, day] = startDate.split('-').map(Number);
    let current = new Date(year, month - 1, day, 12, 0, 0);
    
    let remainingHours = totalHours;
    const hoursPerDay = project.hours_per_day || 8;

    let iterations = 0;
    while (remainingHours > 0 && iterations < 730) {
      iterations++;
      const dayOfWeek = current.getDay();
      const dateStr = format(current, 'yyyy-MM-dd');
      const isWorkingDay = workingDays.map(Number).includes(dayOfWeek);
      
      const specialDay = allHolidays.find(h => h.date === dateStr);

      if (isWorkingDay) {
        if (specialDay) {
          remainingHours -= Number(specialDay.hours || 0);
        } else {
          remainingHours -= hoursPerDay;
        }
      }
      
      if (remainingHours > 0) {
        current = addDays(current, 1);
      }
    }
    return current;
  };

  const endDate = calculateEndDate();

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
              <label className="config-label">Fecha de Inicio</label>
              <input 
                type="date" 
                value={startDate} 
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
