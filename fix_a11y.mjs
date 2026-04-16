import fs from 'fs';
import path from 'path';

const file = path.resolve('src/components/ProposalBuilder.tsx');
let content = fs.readFileSync(file, 'utf8');

// select
content = content.replace(/<select/g, '<select title="Opciones"');
// input
content = content.replace(/<input type="file"/g, '<input title="Subir archivo" type="file"');
content = content.replace(/<textarea/g, '<textarea title="Texto libre"');
content = content.replace(/<input className="table-input"/g, '<input title="Dato de tabla" className="table-input"');
content = content.replace(/<input className="table-input no-print"/g, '<input title="Costo numérico" className="table-input no-print"');
content = content.replace(/<input className="block-input title-input"/g, '<input title="Título" className="block-input title-input"');
// button
content = content.replace(/<button([^>]*)><Trash2/g, '<button title="Eliminar" $1><Trash2');
content = content.replace(/<button className="text-button" onClick/g, '<button title="Añadir" className="text-button" onClick');

fs.writeFileSync(file, content);
console.log('Done replacing tags without titles');
