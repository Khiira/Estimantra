# Estrategia de Negocio y Planes de Pago - Estimantra

Este documento detalla la estrategia de monetización de Estimantra mediante el uso de Stripe para el cobro de suscripciones a nuestros usuarios.

## 1. El Valor de Estimantra (Core)
- **Precisión**: Estimaciones basadas en perfiles técnicos reales y costos configurables.
- **Seguridad**: Versionado inmutable para comparar cambios de alcance.
- **Eficiencia**: Seguimiento dinámico que salta feriados y fines de semana automáticamente.
- **Colaboración**: Trabajo en tiempo real con bloqueo de edición entre compañeros.

---

## 2. Definición de Planes (Uso Interno de Stripe para Suscripciones)

### Plan Freelance (Starter)
*Para profesionales independientes que están empezando.*
- **Precio**: $0 (Gratis).
- **Proyectos**: 2 activos.
- **Versiones**: Máximo 3 por proyecto.
- **Colaboradores**: 0 (Solo el dueño de la cuenta).
- **Soporte**: Documentación pública.

### Plan Team (Pro)
*Para equipos pequeños que necesitan planificar y colaborar.*
- **Precio**: $24.99 USD / mes (Cobrado vía Stripe por Estimantra).
- **Proyectos**: Hasta 20 activos.
- **Colaboradores**: Hasta 5 asientos incluidos.
- **Seguimiento Premium**: Dashboard de Seguimiento completo y Calendario Inteligente.
- **Versiones**: Ilimitadas.

### Plan Agency (Premium)
*Capacidad total para grandes agencias con múltiples proyectos y equipos.*
- **Precio**: $59.99 USD / mes (Cobrado vía Stripe por Estimantra).
- **Proyectos y Colaboradores**: Ilimitados.
- **Administración**: Gestión de permisos avanzada y roles de administrador.
- **Branding**: Remoción de marca Estimantra ("White Label") en exportaciones y links compartidos.
- **Audit Log**: Historial completo de cambios por cada miembro del equipo.

---

## 3. Pasarelas de Pago y Alternativas

Para maximizar la conversión de usuarios, se proponen las siguientes opciones de cobro para las suscripciones:

### A. Stripe (Global)
- **Uso**: Pagos con tarjetas de crédito internacionales y Apple/Google Pay.
- **Ventaja**: Manejo automatizado de suscripciones recurrentes y portal de cliente.

### B. Mercado Pago (Local Latam - Chile/Arg/Mex)
- **Uso**: Ideal para el mercado local chileno y latinoamericano.
- **Ventaja**: Permite pagos con **Redcompra**, tarjetas de crédito locales en **cuotas** y dinero en cuenta de Mercado Pago.
- **Implementación**: Integración vía SDK de Mercado Pago vinculado a una Edge Function de InsForge para validar el `status` del pago.

### C. PayPal (Internacional)
- **Uso**: Usuarios que no desean ingresar su tarjeta directamente o que manejan fondos en dólares.
- **Ventaja**: Confianza global y facilidad de uso.

### D. Transferencia Bancaria Directa (Solo Plan Agency)
- **Uso**: Para empresas grandes que requieren factura local y procesos de compra tradicionales.
- **Ventaja**: Evita comisiones de pasarelas para montos altos.
- **Flujo**: El usuario solicita el plan, se le envía la factura y un administrador de Estimantra activa el plan manualmente tras recibir el comprobante.

---

## 4. Hoja de Ruta de Implementación de Pagos

### Fase 1: Sincronización de Planes
- Implementar **Stripe Billing** (y opcionalmente Mercado Pago) para manejar los ciclos de cobro.
- Centralizar la validación de planes en un `context` de React para habilitar/deshabilitar UI.

### Fase 2: Control de Cuotas (RLS)
- Usar el backend de InsForge para verificar suscripciones activas.
- Aplicar límites de proyectos y colaboradores mediante políticas RLS en la base de datos.

### Fase 3: Portal y Gestión
- Permitir que los usuarios autogestionen su plan, vean facturas y actualicen métodos de pago de forma autónoma.
