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
2. Copia `.env.example` a `.env.local` y completa:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` solo en servidor, necesaria para crear usuarios Auth desde el panel.
3. Ejecuta la migracion `supabase/migrations/0001_initial_schema.sql`.
4. Abre la app. Si no existe ningun Super Admin, aparecera la pantalla de configuracion inicial.
5. El setup inicial crea solo el Super Admin global. Los negocios se crean despues desde el panel Super Admin.

La app usa Supabase como fuente principal cuando existen las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Si no existen, cae al estado local limpio solo como respaldo temporal de desarrollo.

Para el primer Super Admin, desactiva confirmacion obligatoria de email en Supabase Auth durante el bootstrap o confirma el email antes de continuar, porque el perfil inicial necesita una sesion autenticada para insertar negocio, metodos, categorias y perfil.

## Roles operativos

- Super Admin: usuario global sin negocio asociado; gestiona todos los negocios, usuarios, roles, auditoria y reapertura de meses.
- Admin del Negocio: opera solo su negocio, crea ventas/gastos, cierra mes y crea usuarios de Contabilidad.
- Contabilidad: acceso de lectura, informes, historial, cierres, PDF, Excel e impresion.

En la version local puedes cambiar el usuario activo desde la barra lateral para validar permisos. En produccion, este selector debe reemplazarse por Supabase Auth con email y contrasena.
