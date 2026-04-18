import { test, expect, Page } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'test@estimantra.dev';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByPlaceholder('correo@ejemplo.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /Iniciar Sesión por Correo/i }).click();
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

async function createProjectAndNavigate(page: Page): Promise<string> {
  const projectName = `E2E Proyecto ${Date.now()}`;
  await page.getByRole('button', { name: /Nuevo Proyecto/i }).click();
  await page.getByPlaceholder(/Rediseño App/i).fill(projectName);
  await page.getByRole('button', { name: /Continuar a Detalles/i }).click();
  await expect(page).toHaveURL(/\/project\/.+/, { timeout: 15000 });
  await page.waitForSelector('.workspace-header', { timeout: 10000 });
  return projectName;
}

test.describe('Estimador de Proyecto', () => {
  let projectUrl: string;

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.waitForSelector('h2', { timeout: 10000 });
    await createProjectAndNavigate(page);
    projectUrl = page.url();
  });

  // ── Header y Totales ──────────────────────────────────────────────────────
  test('Header del estimador muestra nombre del proyecto', async ({ page }) => {
    await expect(page.locator('.workspace-header h2')).toBeVisible();
  });

  test('Muestra totales iniciales en cero', async ({ page }) => {
    await expect(page.getByText('0h')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/UF 0.00/i)).toBeVisible();
  });

  test('Panel de perfiles técnicos existe', async ({ page }) => {
    await expect(page.getByText('Perfiles Técnicos')).toBeVisible();
  });

  test('Panel de tareas existe', async ({ page }) => {
    await expect(page.getByText('Estimador (Tareas)')).toBeVisible();
    await expect(page.getByText('Añadir Fase Principal')).toBeVisible();
  });

  // ── Selector de Versión ───────────────────────────────────────────────────
  test('Selector de versión muestra v1.0 por defecto', async ({ page }) => {
    const versionSelect = page.locator('.version-select');
    await expect(versionSelect).toHaveValue('1.0');
  });

  test('Botón "+ Versión" existe en el header', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Versión' })).toBeVisible();
  });

  // ── Crear Tareas ──────────────────────────────────────────────────────────
  test('Crear una tarea raíz correctamente', async ({ page }) => {
    const taskName = `Tarea Root ${Date.now()}`;
    await page.getByText('Añadir Fase Principal').click();
    
    const input = page.locator('.add-task-inline input');
    await expect(input).toBeVisible();
    await input.fill(taskName);
    await input.press('Enter');
    
    // La tarea debe aparecer en el árbol
    await expect(page.getByText(taskName)).toBeVisible({ timeout: 10000 });
  });

  test('Crear tarea raíz y verificar que NO hay error de "version"', async ({ page }) => {
    // Este test específicamente prueba el bug #1 (columna version ausente)
    const taskName = `Version Bug Test ${Date.now()}`;
    await page.getByText('Añadir Fase Principal').click();
    
    const input = page.locator('.add-task-inline input');
    await input.fill(taskName);
    
    // Capturar si aparece un alert de error
    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.dismiss();
    });
    
    await input.press('Enter');
    await page.waitForTimeout(3000);
    
    // No debe haber aparecido ningún alert con "Error al crear tarea"
    expect(alertMessage).not.toContain('Error al crear tarea');
    
    // La tarea debe existir en el DOM
    await expect(page.getByText(taskName)).toBeVisible({ timeout: 10000 });
  });

  test('Crear subtarea de una tarea existente', async ({ page }) => {
    // Crear tarea padre primero
    const parentName = `Fase ${Date.now()}`;
    await page.getByText('Añadir Fase Principal').click();
    const rootInput = page.locator('.add-task-inline input');
    await rootInput.fill(parentName);
    await rootInput.press('Enter');
    await expect(page.getByText(parentName)).toBeVisible({ timeout: 10000 });

    // Hover para ver el botón "+" de subtarea
    const taskNode = page.locator('.task-node').filter({ hasText: parentName });
    await taskNode.hover();
    const addSubBtn = taskNode.locator('button[title="Añadir subtarea"]');
    await addSubBtn.click();

    const subTaskName = `Subtarea ${Date.now()}`;
    const subInput = page.locator('.add-task-inline input').last();
    await subInput.fill(subTaskName);
    await subInput.press('Enter');
    
    await expect(page.getByText(subTaskName)).toBeVisible({ timeout: 10000 });
  });

  test('Eliminar una tarea muestra confirmación', async ({ page }) => {
    // Crear una tarea para eliminar
    const taskName = `Eliminar ${Date.now()}`;
    await page.getByText('Añadir Fase Principal').click();
    const input = page.locator('.add-task-inline input');
    await input.fill(taskName);
    await input.press('Enter');
    await expect(page.getByText(taskName)).toBeVisible({ timeout: 10000 });

    // Rechazar la confirmación
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Eliminar');
      await dialog.dismiss();
    });

    const taskNode = page.locator('.task-node').filter({ hasText: taskName });
    await taskNode.hover();
    await taskNode.locator('button[title="Eliminar"]').click();
    
    // La tarea debe seguir visible (rechazamos el confirm)
    await expect(page.getByText(taskName)).toBeVisible();
  });

  // ── Perfiles Técnicos (Roles) ─────────────────────────────────────────────
  test('Botón "+" en perfiles abre el formulario de nuevo perfil', async ({ page }) => {
    const addRoleBtn = page.locator('.roles-panel .icon-btn.text-button');
    await addRoleBtn.click();
    await expect(page.locator('.role-form')).toBeVisible();
  });

  test('Crear un perfil técnico con nombre y costo', async ({ page }) => {
    // Abrir formulario de rol
    await page.locator('.roles-panel .icon-btn.text-button').click();
    
    // Llenar nombre del perfil
    await page.locator('#role_name').fill('Frontend Developer');
    await page.locator('#role_cost').fill('1.5');
    
    // Guardar
    await page.locator('.role-form-actions button[type="submit"]').click();
    
    // El rol debe aparecer en la lista
    await expect(page.getByText('Frontend Developer')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1.5 UF/h')).toBeVisible();
  });

  // ── Estimación de horas (leaf tasks) ─────────────────────────────────────
  test('Input de horas en tarea hoja actualiza el total', async ({ page }) => {
    // Crear una tarea raíz (hoja)
    const taskName = `Horas Test ${Date.now()}`;
    await page.getByText('Añadir Fase Principal').click();
    const input = page.locator('.add-task-inline input');
    await input.fill(taskName);
    await input.press('Enter');
    await expect(page.getByText(taskName)).toBeVisible({ timeout: 10000 });

    // Ingresar horas
    const hoursInput = page.locator('.task-node').filter({ hasText: taskName }).locator('.hours-input');
    await hoursInput.fill('8');
    await hoursInput.press('Tab');
    
    // El total de horas debe actualizarse
    await expect(page.getByText('8h')).toBeVisible({ timeout: 5000 });
  });

  // ── Tabs ─────────────────────────────────────────────────────────────────
  test('Tab "Ingeniería" activo por defecto', async ({ page }) => {
    const estimatorTab = page.getByRole('button', { name: /Ingeniería/i });
    await expect(estimatorTab).toHaveClass(/active/);
  });

  test('Cambiar al tab "Resumen de Presupuesto"', async ({ page }) => {
    await page.getByRole('button', { name: /Resumen de Presupuesto/i }).click();
    await expect(page.locator('.proposal-builder')).toBeVisible({ timeout: 5000 });
  });

  // ── Botón Volver ─────────────────────────────────────────────────────────
  test('Botón "Volver al inicio" navega al dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /Volver al inicio/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });
});
