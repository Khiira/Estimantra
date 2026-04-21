# Hoja de Ruta: Mejoras de Estimantra

Este documento detalla las funcionalidades pendientes y en desarrollo para la plataforma de estimación y seguimiento.

## Próximos Pasos Prioritarios

### 1. Gestión de Estados de Proyecto
Un proyecto ahora puede transitar por tres estados:
- **🟢 En Progreso**: Estado inicial donde se pueden añadir tareas, roles y modificar la estimación.
- **🟡 En Espera**: Proyecto pausado o bloqueado. Se deshabilita la edición de tareas y roles.
- **🔵 Aprobado**: El proyecto ha sido aceptado y pasa a la fase de **Seguimiento**.

### 2. Dashboard de Seguimiento (Completado)
- [x] Implementar estados de proyecto (`En Progreso`, `En Espera`, `Aprobado`).
- [x] Bloqueo de edición (`readOnly`) para proyectos en espera o aprobados.
- [x] Interfaz de **Seguimiento de Proyecto** (Dashboard Premium).
- [x] Calendario Inteligente:
    - [x] Configuración de fecha de inicio.
    - [x] Selección de jornada laboral (días hábiles).
    - [x] Integración con API de Feriados (Chile) y feriados manuales.
    - [x] Persistencia de feriados en la base de datos (Columna `auto_holidays`).
    - [x] Cálculo automático de fecha de finalización (salto de feriados y fines de semana).
- [x] Layout colapsable para maximizar espacio de trabajo.
- [x] Scroll de jornada laboral por arrastre (Drag & Scroll).

### 3. Indicadores de Avance Real (Pendiente)
- [ ] Marcado de tareas completadas en el `TaskTree`.
- [ ] Actualización de barra de progreso en Seguimiento en base a tareas reales.
- [ ] Comparativa visual entre lo estimado vs. lo ejecutado.
- [ ] **Indicadores Visuales**: Barras de progreso por tarea y porcentaje de avance general del proyecto.

### 4. Grilla de Proyectos (Pendiente)
- Crear una **Grilla Principal** (similar a la de estimación) que permita ver todos los proyectos activos en su versión aprobada.
- Permitir la búsqueda y filtrado por estado, avance o fechas.
