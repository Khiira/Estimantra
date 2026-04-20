# Estimantra · Estimaciones Técnicas Premium

Estimantra es una plataforma avanzada de presupuestación y estimación de proyectos diseñada para equipos de ingeniería y diseño. Centraliza el cálculo de costos, la gestión de perfiles técnicos y la colaboración en tiempo real bajo una interfaz de alta fidelidad.

## 🚀 Tecnologías Core

La plataforma utiliza un stack moderno enfocado en el rendimiento y la seguridad:

- **Frontend**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) para una experiencia de usuario rápida y reactiva.
- **BaaS (Backend as a Service)**: [InsForge SDK](https://insforge.com) para gestión de datos, autenticación y funciones de borde.
- **Base de Datos**: [PostgreSQL](https://www.postgresql.org/) gestionado con aislamiento multi-tenant.
- **Estilos**: Vanilla CSS con un **Sistema de Diseño Global** basado en variables CSS y estética *Glassmorphism*.
- **Routing**: [Wouter](https://github.com/molecula-js/wouter) para un enrutamiento ligero y eficiente.
- **Iconos**: [Lucide React](https://lucide.dev/) para una iconografía semántica y consistente.

## 🏗️ Patrones y Arquitectura

El desarrollo de Estimantra sigue principios de ingeniería sólida:

### 1. Atomic CSS Architecture

Hemos centralizado todos los estilos en `index.css` eliminando el uso de estilos inline y bloques `<style>` internos. Utilizamos:

- **Design Tokens**: Variables CSS para colores (Mint Green, Deep Blue), espaciados y sombras.
- **Utility Classes**: Clases reutilizables para layouts flexbox, grid y tipografía.
- **Premium Glassmorphism**: Efectos de desenfoque de fondo y transparencias controladas en toda la UI.

### 2. Client-Side BaaS Pattern

La lógica de negocio interactúa directamente con los servicios de InsForge desde el cliente, optimizando el tiempo de respuesta:

- **Auth**: Gestión de sesiones y flujos de OTP (One-Time Password) integrados.
- **Realtime Sync**: Sincronización automática de proyectos y tareas mediante suscripciones WebSockets.

### 3. Role-Based Access Control (RBAC)

La seguridad no solo reside en el cliente, sino que se valida en el núcleo:

- **Row Level Security (RLS)**: Las políticas de base de datos garantizan que los usuarios solo accedan a los datos de sus organizaciones autorizadas.

## 📊 Estructura de Datos (PostgreSQL)

El esquema de base de datos está normalizado para escalar eficientemente:

- **organizations**: Entidad raíz para el multi-tenancy.
- **projects**: Cabecera de las estimaciones (metadatos, cliente, moneda).
- **tasks**: Árbol recursivo de subtareas con horas estimadas y perfiles asignados.
- **profiles**: Detalles de usuario y avatar.
- **roles**: Definición de perfiles técnicos (Ej. Senior Dev, UX Designer) con sus respectivos costos.

## 🛠️ Instalación y Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Construir para producción
npm run build
```

## 🌐 Despliegue

La plataforma se despliega automáticamente mediante **InsForge CLI**, garantizando que el bundle final esté optimizado y las variables de entorno sean seguras.

---
**Estimantra** · *Built for scaling engineering teams.*
