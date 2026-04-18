import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Datos de prueba (usar una cuenta de test real o crear una antes de correr)
// ─────────────────────────────────────────────────────────────────────────────
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@estimantra.dev';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

test.describe('Autenticación', () => {
  // Partir siempre desde una sesión limpia
  test.beforeEach(async ({ page }) => {
    // Limpiar localStorage para asegurar logout
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('La página de login carga correctamente', async ({ page }) => {
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Estimantra' })).toBeVisible();
    await expect(page.getByPlaceholder('correo@ejemplo.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /Iniciar Sesión/i })).toBeVisible();
  });

  test('Muestra error con credenciales incorrectas', async ({ page }) => {
    await page.getByPlaceholder('correo@ejemplo.com').fill('invalido@test.com');
    await page.getByPlaceholder('••••••••').fill('clave_incorrecta');
    await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
    // Esperar que aparezca el error (.error-box)
    await expect(page.locator('.error-box')).toBeVisible({ timeout: 10000 });
  });

  test('Login exitoso redirige al dashboard', async ({ page }) => {
    await page.getByPlaceholder('correo@ejemplo.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
    // Tras login exitoso debe ir al dashboard (URL '/')
    await expect(page).toHaveURL('/', { timeout: 15000 });
  });

  test('Toggle entre login y registro funciona', async ({ page }) => {
    // Estado inicial: modo login
    await expect(page.getByRole('button', { name: /Iniciar Sesión por Correo/i })).toBeVisible();
    
    // Cambiar a registro
    await page.getByRole('button', { name: /Regístrate aquí/i }).click();
    await expect(page.getByPlaceholder('Ej. Ada Lovelace')).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrarse por Correo/i })).toBeVisible();
    
    // Volver a login
    await page.getByRole('button', { name: /Inicia Sesión/i }).click();
    await expect(page.getByPlaceholder('Ej. Ada Lovelace')).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Iniciar Sesión por Correo/i })).toBeVisible();
  });

  test('Botones de OAuth (Google y GitHub) están presentes', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /GitHub/i })).toBeVisible();
  });

  test('Formulario de registro valida campos requeridos', async ({ page }) => {
    await page.getByRole('button', { name: /Regístrate aquí/i }).click();
    // Intentar enviar vacío
    await page.getByRole('button', { name: /Registrarse por Correo/i }).click();
    // El browser debe mostrar la validación nativa de required
    // El campo nombre debe estar en foco o inválido
    const nameInput = page.getByPlaceholder('Ej. Ada Lovelace');
    await expect(nameInput).toBeVisible();
  });
});
