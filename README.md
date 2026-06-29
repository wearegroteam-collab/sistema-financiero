# Hangar Finanzas

Aplicacion web moderna para administrar las finanzas mensuales de un restaurante, preparada como arquitectura multiempresa.

## Incluye

- Dashboard mensual con saldos por BOLD, Bancolombia, Nequi y Efectivo.
- Registro de venta diaria con validacion obligatoria de distribucion.
- Registro de egresos por Nomina, Inventario, Extras y Gastos Fijos.
- Cierre de mes con bloqueo de edicion/eliminacion y reapertura para Super Admin.
- Informes con filtros, graficos, exportacion Excel `.xls` y descarga PDF.
- Historial completo, configuracion, usuarios, roles y auditoria local.
- Migracion inicial de Supabase con tablas, constraints, triggers y politicas RLS.
- Panel de Super Admin para negocios, usuarios, roles, selector de negocio y auditoria general.
- Descarga real de PDF para informes y cierres, exportacion Excel `.xls` e impresion con notificaciones.

## Ejecutar

```bash
npm install
npm run dev
```

Luego abre `http://localhost:3000`.

## Supabase

1. Crea un proyecto en Supabase.
2. Copia `.env.example` a `.env.local` y completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Ejecuta la migracion `supabase/migrations/0001_initial_schema.sql`.
4. Opcionalmente ejecuta `supabase/seed.sql` para crear Hangar, categorias y metodos de pago.

La UI local inicia sin movimientos, cierres ni usuarios de prueba. La carpeta `lib/supabase` y las migraciones dejan la base preparada para conectar Supabase Auth y datos reales.

## Roles operativos

- Super Admin: gestiona todos los negocios, usuarios, roles, auditoria y reapertura de meses.
- Admin del Negocio: opera solo su negocio, crea ventas/gastos, cierra mes y crea usuarios de Contabilidad.
- Contabilidad: acceso de lectura, informes, historial, cierres, PDF, Excel e impresion.

En la version local puedes cambiar el usuario activo desde la barra lateral para validar permisos. En produccion, este selector debe reemplazarse por Supabase Auth con email y contrasena.
