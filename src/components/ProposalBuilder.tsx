import { useState, useRef } from 'react';
import { Copy, Check } from 'lucide-react';

export default function ProposalBuilder({ project, tasks, roles, grandTotals }: any) {
  const [copied, setCopied] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  // Funciones de cálculo basadas en el árbol de tareas
  const calcNode = (tId: string): { hours: number, cost: number } => {
      const task = tasks.find((t:any) => t.id === tId);
      if (!task) return { hours: 0, cost: 0 };
      const children = tasks.filter((t:any) => t.parent_id === tId);
      
      // Si es hoja (no tiene hijos)
      if (children.length === 0) {
          const role = roles.find((r:any) => r.id === task.assigned_role_id);
          const rate = role ? Number(role.hourly_rate) : 0;
          const hrs = Number(task.estimated_hours) || 0;
          return { hours: hrs, cost: hrs * rate };
      }

      // Si es contenedor, suma todo lo de sus hijos
      return children.reduce((acc:any, child:any) => {
          const res = calcNode(child.id);
          return { hours: acc.hours + res.hours, cost: acc.cost + res.cost };
      }, { hours: 0, cost: 0 });
  };

  // Convertimos el árbol en una tabla plana para exportar
  const tableData: any[] = [];
  const traverse = (tId: string, level: number) => {
      const task = tasks.find((t:any) => t.id === tId);
      if (!task) return;
      const { hours, cost } = calcNode(tId);
      
      tableData.push({ 
         name: '   '.repeat(level) + task.task_name, 
         description: task.description || '',
         hours: hours,
         cost: cost,
         isParent: tasks.some((t:any) => t.parent_id === tId)
      });

      const children = tasks.filter((t:any) => t.parent_id === tId);
      children.forEach((c:any) => traverse(c.id, level + 1));
  };

  // Iniciamos por los nodos raíz
  const parentTasks = tasks.filter((t:any) => !t.parent_id);
  parentTasks.forEach((p:any) => traverse(p.id, 0));

  const copyToClipboard = () => {
      const hpd = project.hours_per_day || 8;
      // 1. Formato TSV para Excel
      let tsv = 'Concepto\tDescripción\tHoras\tDías\n';
      tableData.forEach(row => {
          const desc = row.description.replace(/\n/g, ' ');
          const days = (row.hours / hpd).toFixed(1);
          tsv += `${row.name.trim()}\t${desc}\t${row.hours}\t${days}\n`;
      });
      const totalDays = (grandTotals.hours / hpd).toFixed(1);
      tsv += `\nTOTAL ESTIMADO\t\t${grandTotals.hours}\t${totalDays}\n`;

      // 2. Formato HTML para Word (con estilos inline para máxima compatibilidad)
      const htmlString = `
        <table style="border-collapse: collapse; width: 100%; font-family: Calibri, sans-serif; border: 1px solid #005A9C;">
          <thead>
            <tr style="background-color: #005A9C; color: white;">
              <th style="border: 1px solid #005A9C; padding: 10px; text-align: left;">Concepto</th>
              <th style="border: 1px solid #005A9C; padding: 10px; text-align: left;">Descripción</th>
              <th style="border: 1px solid #005A9C; padding: 10px; text-align: right;">Horas</th>
              <th style="border: 1px solid #005A9C; padding: 10px; text-align: right;">Días</th>
            </tr>
          </thead>
          <tbody>
            ${tableData.map(row => {
              const rowDays = (row.hours / hpd).toFixed(1);
              return `
              <tr style="background-color: ${row.isParent ? '#f2f2f2' : '#ffffff'}; font-weight: ${row.isParent ? 'bold' : 'normal'};">
                <td style="border: 1px solid #ccc; padding: 8px;">${row.name.replace(/\s/g, '&nbsp;')}</td>
                <td style="border: 1px solid #ccc; padding: 8px; color: #333;">${row.description}</td>
                <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">${row.hours || ''}</td>
                <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">${row.hours ? rowDays : ''}</td>
              </tr>
            `}).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #eef3fa; font-weight: bold;">
              <td colspan="2" style="border: 1px solid #005A9C; padding: 12px; color: #005A9C;">TOTAL ESTIMADO FINAL</td>
              <td style="border: 1px solid #005A9C; padding: 12px; text-align: right; color: #005A9C;">${grandTotals.hours}h</td>
              <td style="border: 1px solid #005A9C; padding: 12px; text-align: right; color: #005A9C;">${totalDays}d</td>
            </tr>
          </tfoot>
        </table>
      `;

      const blobHtml = new Blob([htmlString], { type: 'text/html' });
      const blobText = new Blob([tsv], { type: 'text/plain' });
      
      const clipboardData = [
          new ClipboardItem({
              'text/html': blobHtml,
              'text/plain': blobText
          })
      ];

      navigator.clipboard.write(clipboardData).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      });
  };

  return (
    <div className="proposal-builder animate-fade-in">
      <div className="builder-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'var(--color-bg-secondary)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
        <div>
           <h3 style={{margin: '0 0 5px 0'}}>Exportar Tabla de Presupuesto</h3>
           <p style={{margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.95rem'}}>Cópialo directamente a tu propuesta de Word o descárgalo en Excel.</p>
        </div>
        <div style={{display: 'flex', gap: '15px'}}>
            <button className="primary" onClick={copyToClipboard} title="Copiar como tabla con formato para Word/Excel" style={{ minWidth: '240px' }}>
               {copied ? <Check size={18}/> : <Copy size={18}/>} 
               {copied ? '¡Tabla Copiada!' : 'Copiar Tabla para Propuesta'}
            </button>
        </div>
      </div>

      <div style={{ background: 'white', padding: '40px', borderRadius: 'var(--radius-lg)', color: 'black', overflowX: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          <h2 style={{marginTop: 0, color: '#005A9C', borderBottom: '2px solid #005A9C', paddingBottom: '10px'}}>{project.name} - Detalle Técnico</h2>
          <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', fontFamily: 'inherit' }}>
              <thead>
                  <tr>
                      <th style={{ borderBottom: '2px solid #ccc', padding: '12px', textAlign: 'left', color: '#005A9C' }}>Concepto</th>
                      <th style={{ borderBottom: '2px solid #ccc', padding: '12px', textAlign: 'left', color: '#005A9C' }}>Descripción</th>
                      <th style={{ borderBottom: '2px solid #ccc', padding: '12px', textAlign: 'right', color: '#005A9C' }}>Horas</th>
                      <th style={{ borderBottom: '2px solid #ccc', padding: '12px', textAlign: 'right', color: '#005A9C' }}>Días</th>
                  </tr>
              </thead>
              <tbody>
                  {tableData.length === 0 ? (
                      <tr><td colSpan={4} style={{padding: '30px', textAlign: 'center', color: '#888'}}>No hay tareas cargadas en el árbol.</td></tr>
                  ) : tableData.map((row, index) => (
                      <tr key={index} style={{ backgroundColor: row.isParent ? '#f9f9f9' : 'transparent', fontWeight: row.isParent ? '600' : 'normal' }}>
                          <td style={{ borderBottom: '1px solid #eee', padding: '12px' }}><pre style={{margin:0, fontFamily: 'inherit'}}>{row.name}</pre></td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '12px', color: '#555', maxWidth: '300px' }}>{row.description}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '12px', textAlign: 'right' }}>{row.hours !== 0 || !row.isParent ? row.hours : ''}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '12px', textAlign: 'right' }}>{row.hours !== 0 || !row.isParent ? (row.hours / (project.hours_per_day || 8)).toFixed(1) : ''}</td>
                      </tr>
                  ))}
              </tbody>
              {tableData.length > 0 && (
                <tfoot>
                    <tr style={{ backgroundColor: '#eef3fa', fontWeight: 'bold' }}>
                        <td style={{ padding: '15px 12px', borderTop: '2px solid #005A9C', color: '#005A9C' }}>TOTAL ESTIMADO FINAL</td>
                        <td style={{ padding: '15px 12px', borderTop: '2px solid #005A9C' }}></td>
                        <td style={{ padding: '15px 12px', borderTop: '2px solid #005A9C', textAlign: 'right', color: '#005A9C' }}>{grandTotals.hours}h</td>
                        <td style={{ padding: '15px 12px', borderTop: '2px solid #005A9C', textAlign: 'right', color: '#005A9C' }}>{(grandTotals.hours / (project.hours_per_day || 8)).toFixed(1)}d</td>
                    </tr>
                </tfoot>
              )}
          </table>
      </div>
    </div>
  );
}
