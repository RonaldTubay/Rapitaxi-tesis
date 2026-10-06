<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Roles y permisos base del sistema. Nuevos permisos/roles se agregan
     * aqui (o desde una futura pantalla de administracion) sin tocar
     * ningun controlador ni middleware.
     */
    private array $permissionsByModule = [
        'usuarios' => ['ver', 'crear', 'editar', 'eliminar'],
        'socios' => ['ver', 'crear', 'editar', 'eliminar'],
        'vehiculos' => ['ver', 'crear', 'editar', 'eliminar'],
        'expedientes' => ['ver', 'crear', 'eliminar'],
        'mantenimientos' => ['ver', 'crear', 'editar', 'eliminar'],
        'revisiones' => ['ver', 'crear', 'editar', 'eliminar'],
        'aportaciones' => ['ver', 'crear', 'eliminar'],
        'libros-contables' => ['ver', 'crear', 'eliminar'],
        'reportes' => ['ver'],
        'configuracion' => ['ver', 'editar'],
    ];

    public function run(): void
    {
        $allPermissions = collect($this->permissionsByModule)
            ->flatMap(fn (array $acciones, string $modulo) => collect($acciones)->map(fn ($accion) => "{$modulo}.{$accion}"));

        $allPermissions->each(fn (string $permiso) => Permission::firstOrCreate(['name' => $permiso]));

        $admin = Role::firstOrCreate(['name' => 'admin']);
        $admin->syncPermissions($allPermissions);

        $operador = Role::firstOrCreate(['name' => 'operador']);
        $operador->syncPermissions(
            $allPermissions->reject(fn (string $permiso) => str_starts_with($permiso, 'usuarios.') || str_starts_with($permiso, 'configuracion.'))
        );

        // Reservado para el futuro portal de socios (solo lectura de su propia info).
        Role::firstOrCreate(['name' => 'socio']);
    }
}
