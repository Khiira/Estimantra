import { test, expect, Page } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'test@estimantra.dev';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByPlaceholder('correo@ejemplo.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /Iniciar Sesión por Correo/i }).click();
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

async function createProjectAndOpenProposal(page: Page) {
  // Crear proyecto
  await page.getByRole('button', { name: /Nuevo Proyecto/i }).click();
  await page.getByPlaceholder(/Rediseño App/i).fill(`Propuesta Test ${Date.now()}`);
  await page.getByRole('button', { name: /Continuar a Detalles/i }).click();
  await expect(page).toHaveURL(/\/project\/.+/, { timeout: 15000 });
  await page.waitForSelector('.workspace-header', { timeout: 10000 });

  // Agregar tarea con horas para que la propuesta tenga datos
  await page.getByText('Añadir Fase Principal').click();
  const input = page.locator('.add-task-inline input');
  await input.fill('Fase de Diseño');
  await input.press('Enter');
  await expect(page.getByText('Fase de Diseño')).toBeVisible({ timeout: 10000 });
  
  // Ingresar horas a la tarea
  const hoursInput = page.locator('.task-node').filter({ hasText: 'Fase de Diseño' }).locator('.hours-input');
  await hoursInput.fill('16');
  await hoursInput.press('Tab');
  await page.waitForTimeout(1000); // Debounce de 500ms + margen

  // Navegar al tab de propuesta
  await page.getByRole('button', { name: /Resumen de Presupuesto/i }).click();
  await expect(page.locator('.proposal-builder')).toBeVisible({ timeout: 5000 });
}

test.describe('Propuesta / Presupuesto', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.waitForSelector('h2', { timeout: 10000 });
    await createProjectAndOpenProposal(page);
  });

  test('Vista de propuesta carga correctamente', async ({ page }) => {
    await expect(page.locator('.proposal-builder')).toBeVisible();
    await expect(page.getByText(/Copiar Tabla de Presupuesto/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Copiar Tabla para Propuesta/i })).toBeVisible();
  });

  test('Tabla de la propuesta contiene las tareas creadas', async ({ page }) => {
    await expect(page.getByText('Fase de Diseño')).toBeVisible({ timeout: 5000 });
  });

  test('Tabla muestra las horas correctas', async ({ page }) => {
    // Las 16 horas que ingresamos deben aparecer en la tabla
    const cells = page.locator('td');
    const found = await cells.filter({ hasText: '16' }).count();
    expect(found).toBeGreaterThan(0);
  });

  test('Tabla muestra la fila de TOTAL ESTIMADO FINAL', async ({ page }) => {
    await expect(page.getByText('TOTAL ESTIMADO FINAL')).toBeVisible();
  });

  test('Botón "Copiar Tabla para Propuesta" es clickeable', async ({ page }) => {
    const copyBtn = page.getByRole('button', { name: /Copiar Tabla para Propuesta/i });
    await expect(copyBtn).toBeEnabled();
    // No podemos verificar el clipboard directamente pero el botón no debe fallar
    await copyBtn.click();
    // Tras copiar, el botón debe mostrar el estado de éxito "¡Tabla Copiada!"
    await expect(page.getByRole('button', { name: /Tabla Copiada/i })).toBeVisible({ timeout: 5000 });
  });

  test('El estado "¡Tabla Copiada!" se revierte después de 2 segundos', async ({ page }) => {
    await page.getByRole('button', { name: /Copiar Tabla para Propuesta/i }).click();
    await expect(page.getByRole('button', { name: /Tabla Copiada/i })).toBeVisible({ timeout: 5000 });
    // Después de 2 segundos vuelve al texto original
    await expect(page.getByRole('button', { name: /Copiar Tabla para Propuesta/i })).toBeVisible({ timeout: 4000 });
  });

  test('Días totales coinciden con horas / horas_por_día', async ({ page }) => {
    // Con 16 horas y 8h/día, debe mostrar 2.0d en el footer
    await expect(page.getByText('2.0d')).toBeVisible({ timeout: 5000 });
  });

  test('Volver al tab "Ingeniería" desde la propuesta funciona', async ({ page }) => {
    await page.getByRole('button', { name: /Ingeniería/i }).click();
    await expect(page.locator('.tasks-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.proposal-builder')).not.toBeVisible();
  });
});
