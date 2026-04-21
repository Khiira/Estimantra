# Registro de Mejoras y Próximos Pasos

> [!IMPORTANT]
> **Estrategia de Desarrollo**: Todo el trabajo se realizará en la rama `feature/seguimiento-proyectos`. No se realizarán despliegues a producción (PRD) hasta que la funcionalidad esté perfeccionada y validada en entorno local.

## Próximo Paso: Sistema de Gestión de Estados y Seguimiento Activo
El objetivo es transformar la herramienta de una simple "calculadora de estimaciones" a un sistema de gestión de ciclo de vida de proyectos.

### 1. Gestión de Estados (Workflows)
Se implementarán tres estados principales para cada estimación/proyecto:
- **🟢 En Progreso**: El proyecto se está estimando. Todas las celdas y valores son editables.
- **🟡 En Espera de Aprobación**: La estimación ha sido enviada al cliente.
    - **Bloqueo**: Los datos se vuelven de "Solo Lectura" para evitar discrepancias entre lo enviado y lo almacenado.
    - **Retorno**: Si el cliente pide cambios, debe volver manualmente a "En Progreso" para habilitar la edición (esto generará una nueva versión si es necesario).
- **🔵 Aprobada**: El proyecto ha sido aceptado y pasa a la fase de **Seguimiento**.

### 2. Interfaz de Gestión (Grilla de Proyectos)
- Crear una **Grilla Principal** (similar a la de estimación) que permita ver todos los proyectos activos en su version aprobada,
- Permitir la búsqueda y filtrado por estado o avance o fechas.

### 3. Seguimiento de Proyectos Aprobados
Al pasar un proyecto al estado **Aprobado**, se habilitarán las siguientes funciones:
- **Configuración de Tiempos**:
    - Definición de **Fecha de Inicio**.
    - **Calendario Inteligente**: Configuración de fines de semana y carga de feriados para cálculos de entrega realistas, considera la instalacion de librerias que ayuden a todo esto.
- **Control de Avance**:
    - Comparativa visual entre lo estimado vs. lo ejecutado.
    - **Indicadores Visuales**: Barras de progreso por tarea y porcentaje de avance general del proyecto.
    - Visualización del impacto del avance en el presupuesto final.

---

### 📝 Plan de Acción Inmediato
- [x] **Backend**: Campos de estado y seguimiento creados en la DB.
- [x] **UI**: Selector de estado implementado en la cabecera.
- [x] **Lógica**: Bloqueo de edición (readonly) funcional.
- [x] **Seguimiento**: Componente `ProjectTracking` con API de feriados automatizada.
- [ ] **Indicadores Visuales**: Implementar el marcado de tareas completadas para alimentar el avance %.
