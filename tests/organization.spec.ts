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
  await page.waitForSelector('h2', { timeout: 10000 });
}

test.describe('Configuración de Organización', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Navegar a settings de organización
    await page.getByRole('button', { name: /Organización/i }).click();
    await expect(page).toHaveURL('/organization', { timeout: 10000 });
    await page.waitForSelector('.settings-panel', { timeout: 10000 });
  });

  test('Página de organización carga correctamente', async ({ page }) => {
    await expect(page.getByText('Configuración de Empresa')).toBeVisible();
    await expect(page.getByText('Miembros del Equipo')).toBeVisible();
  });

  test('Botón "Generar Invitación Mágica" está visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Generar Invitación Mágica/i })).toBeVisible();
  });

  test('Generar invitación muestra el enlace', async ({ page }) => {
    await page.getByRole('button', { name: /Generar Invitación Mágica/i }).click();
    // El enlace con el token debe aparecer
    const inviteInput = page.locator('input[placeholder="Enlace de invitación"]');
    await expect(inviteInput).toBeVisible({ timeout: 10000 });
    const inviteUrl = await inviteInput.inputValue();
    expect(inviteUrl).toContain('/invite?token=');
    expect(inviteUrl).not.toBe('');
  });

  test('Botón "Copiar" del enlace de invitación existe', async ({ page }) => {
    await page.getByRole('button', { name: /Generar Invitación Mágica/i }).click();
    await expect(page.locator('input[placeholder="Enlace de invitación"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Copiar/i })).toBeVisible();
  });

  test('Sección "Mis Espacios de Trabajo" lista las orgs', async ({ page }) => {
    await expect(page.getByText('Mis Espacios de Trabajo')).toBeVisible();
    // Debe haber al menos 1 org (la actual)
    const orgCards = page.locator('.member-card');
    await expect(orgCards.first()).toBeVisible({ timeout: 5000 });
  });

  test('La org activa muestra el badge "Actual"', async ({ page }) => {
    await expect(page.locator('.badge', { hasText: 'Actual' })).toBeVisible({ timeout: 5000 });
  });

  test('Botón "Nueva Organización" muestra el formulario', async ({ page }) => {
    await page.getByRole('button', { name: /\+ Nueva Organización/i }).click();
    await expect(page.getByPlaceholder(/Agencia Sur/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Crear y Entrar/i })).toBeVisible();
  });

  test('Botón "Volver al Dashboard" navega al inicio', async ({ page }) => {
    await page.getByRole('button', { name: /Volver al Dashboard/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('El usuario actual aparece en la lista de miembros con badge "Tú"', async ({ page }) => {
    // Esperar a que cargue la lista
    await page.waitForSelector('.members-list', { timeout: 10000 });
    await expect(page.locator('.badge', { hasText: 'Tú' })).toBeVisible({ timeout: 10000 });
  });
});
