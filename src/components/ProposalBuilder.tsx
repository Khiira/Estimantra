import { useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface ProposalBuilderProps {
  project: any;
  tasks: any[];
  grandTotals: { hours: number; cost: number };
}

export default function ProposalBuilder({ project, tasks, grandTotals }: ProposalBuilderProps) {

  const tableRef = useRef<HTMLTableElement>(null);
  const [copied, setCopied] = useState(false);

  // Reconstruir el árbol de tareas de forma plana para la tabla de Word/Excel
  const getFlatTableData = () => {
    const flatData: any[] = [];
    
    const traverse = (node: any, depth: number) => {
      // Calculamos totales si es un nodo padre o usamos los directos si es hoja
      const hasChildren = node.children && node.children.length > 0;
      
      const indent = " ".repeat(depth * 4);
      flatData.push({
        name: indent + node.task_name,
        description: node.description || '',
        hours: node.totalHours || node.estimated_hours || 0,
        isParent: hasChildren,
        depth
      });

      if (hasChildren) {
        node.children.forEach((child: any) => traverse(child, depth + 1));
      }
    };

    // Construir jerarquía para calcular totales antes de aplanar
    const taskMap: Record<string, any> = {};
    tasks.forEach(t => taskMap[t.id] = { ...t, children: [], totalHours: 0 });
    
    const rootNodes: any[] = [];
    tasks.forEach(t => {
      if (t.parent_id && taskMap[t.parent_id]) {
        taskMap[t.parent_id].children.push(taskMap[t.id]);
      } else {
        rootNodes.push(taskMap[t.id]);
      }
    });

    const calculateTotals = (node: any) => {
      if (node.children.length === 0) {
        node.totalHours = node.estimated_hours || 0;
        return node.totalHours;
      }
      let sum = 0;
      node.children.forEach((child: any) => {
        sum += calculateTotals(child);
      });
      node.totalHours = sum;
      return sum;
    };

    rootNodes.forEach(calculateTotals);
    rootNodes.forEach(rn => traverse(rn, 0));
    
    return flatData;
  };

  const tableData = getFlatTableData();
  const hpd = project.hours_per_day || 8;

  const copyToClipboard = () => {
      if (!tableRef.current) return;

      // 1. Formato TSV (Tab-Separated Values) para Excel
      let tsv = "Concepto\tDescripción\tHoras\tDías\n";
      tableData.forEach(row => {
        const rowDays = (row.hours / hpd).toFixed(1);
        tsv += `${row.name}\t${row.description}\t${row.hours}\t${row.hours ? rowDays : ''}\n`;
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
           <h3 style={{margin: '0 0 5px 0'}}>Copiar Tabla de Presupuesto</h3>
           <p style={{margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.95rem'}}>Cópialo directamente a tu propuesta de Word o Excel.</p>
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
                  <tr style={{ backgroundColor: '#005A9C', color: 'white' }}>
                      <th style={{ borderBottom: '2px solid #005A9C', padding: '12px', textAlign: 'left' }}>Concepto</th>
                      <th style={{ borderBottom: '2px solid #005A9C', padding: '12px', textAlign: 'left' }}>Descripción</th>
                      <th style={{ borderBottom: '2px solid #005A9C', padding: '12px', textAlign: 'right' }}>Horas</th>
                      <th style={{ borderBottom: '2px solid #005A9C', padding: '12px', textAlign: 'right' }}>Días</th>
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
