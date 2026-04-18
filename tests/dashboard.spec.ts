import { test, expect, Page } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'test@estimantra.dev';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

// ─── Helper: autenticar y esperar dashboard ───────────────────────────────────
async function loginAndWaitForDashboard(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByPlaceholder('correo@ejemplo.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /Iniciar Sesión por Correo/i }).click();
  // Esperar redirección al dashboard
  await expect(page).toHaveURL('/', { timeout: 15000 });
  // Esperar que cargue el contenido del dashboard (no el spinner)
  await page.waitForSelector('h2, .auth-box', { timeout: 10000 });
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWaitForDashboard(page);
  });

  test('Dashboard carga correctamente tras login', async ({ page }) => {
    // Debe mostrar el header con el título "Estimaciones"
    await expect(page.getByRole('heading', { name: /Estimaciones/i })).toBeVisible({ timeout: 10000 });
  });

  test('Botón "Nuevo Proyecto" abre el modal', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Nuevo Proyecto/i });
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    await expect(page.getByRole('heading', { name: /Nueva Estimación/i })).toBeVisible();
  });

  test('Modal de nuevo proyecto tiene todos los campos', async ({ page }) => {
    await page.getByRole('button', { name: /Nuevo Proyecto/i }).click();
    await expect(page.getByPlaceholder(/Rediseño App/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Marketing, SEO/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Nombre del cliente/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Continuar a Detalles/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancelar/i })).toBeVisible();
  });

  test('Cerrar modal con "Cancelar" oculta el formulario', async ({ page }) => {
    await page.getByRole('button', { name: /Nuevo Proyecto/i }).click();
    await expect(page.getByRole('heading', { name: /Nueva Estimación/i })).toBeVisible();
    await page.getByRole('button', { name: /Cancelar/i }).click();
    await expect(page.getByRole('heading', { name: /Nueva Estimación/i })).not.toBeVisible();
  });

  test('Crear un proyecto y navegar a él', async ({ page }) => {
    // Nombre único a base de timestamp para evitar conflictos
    const projectName = `Test Proyecto ${Date.now()}`;
    
    await page.getByRole('button', { name: /Nuevo Proyecto/i }).click();
    await page.getByPlaceholder(/Rediseño App/i).fill(projectName);
    await page.getByRole('button', { name: /Continuar a Detalles/i }).click();
    
    // Debe redirigir al estimador del proyecto
    await expect(page).toHaveURL(/\/project\/.+/, { timeout: 15000 });
    // El nombre del proyecto debe aparecer en el header
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });
  });

  test('Tarifa Plana muestra campo de valor hora', async ({ page }) => {
    await page.getByRole('button', { name: /Nuevo Proyecto/i }).click();
    // Por defecto está en "Detallado (Por Perfil)" — no debe mostrar el campo de tarifa
    await expect(page.getByPlaceholder('Ej: 1.5')).not.toBeVisible();
    
    // Cambiar a Tarifa Plana
    await page.getByTitle('Régimen de cobro').selectOption('flat_rate');
    await expect(page.getByPlaceholder('Ej: 1.5')).toBeVisible();
  });

  test('Botón "Organización" navega a settings', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Organización/i });
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    await expect(page).toHaveURL('/organization', { timeout: 10000 });
  });
});
