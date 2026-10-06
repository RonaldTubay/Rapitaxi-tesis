<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use App\Http\Concerns\ListadoDeTabla;
use App\Rules\NombreDePersona;

class UsuarioController extends Controller
{
    use ListadoDeTabla;

    private const ROLES_ASIGNABLES = ['admin', 'operador'];

    /** Columnas por las que la tabla puede ordenar: nombre publico => columna real. */
    private const COLUMNAS_ORDENABLES = [
        'name' => 'name',
        'email' => 'email',
        'created_at' => 'created_at',
    ];

    public function index(Request $request)
    {
        // Esta pantalla es solo para cuentas de personal interno (admin/operador).
        // Las cuentas de socios (rol "socio") se gestionan desde la pantalla de Socios.
        $query = User::role(self::ROLES_ASIGNABLES)
            ->select('id', 'name', 'email', 'created_at')
            ->with('roles:id,name');

        if ($request->filled('search')) {
            $busqueda = '%' . mb_strtolower($request->search) . '%';
            $query->where(function ($q) use ($busqueda) {
                $q->whereRaw('LOWER(name) LIKE ?', [$busqueda])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$busqueda]);
            });
        }

        $this->ordenar($query, $request, self::COLUMNAS_ORDENABLES, 'name', 'asc');

        $usuarios = $query->paginate($this->porPagina($request));
        $usuarios->setCollection(
            $usuarios->getCollection()->map(fn (User $usuario) => $this->conRol($usuario))
        );

        return response()->json($usuarios, 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', new NombreDePersona],
            'email' => 'required|email|max:100|unique:users,email',
            'password' => ['required', 'string', 'max:100', Password::defaults()],
            'role' => ['required', Rule::in(self::ROLES_ASIGNABLES)],
        ]);

        $usuario = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
        ]);
        $usuario->assignRole($validated['role']);

        return response()->json([
            'message' => 'Usuario creado exitosamente.',
            'usuario' => $this->conRol($usuario),
        ], 201);
    }

    public function update(Request $request, User $usuario)
    {
        if ($usuario->hasRole('socio')) {
            return response()->json(['message' => 'Usuario no encontrado.'], 404);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', new NombreDePersona],
            'email' => [
                'required',
                'email',
                'max:100',
                Rule::unique('users', 'email')->ignore($usuario->id),
            ],
            'password' => ['nullable', 'string', 'max:100', Password::defaults()],
            'role' => ['required', Rule::in(self::ROLES_ASIGNABLES)],
        ]);

        if ($usuario->hasRole('admin') && $validated['role'] !== 'admin' && User::role('admin')->count() <= 1) {
            return response()->json([
                'message' => 'Debe existir al menos un usuario administrador.',
            ], 422);
        }

        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $cambiaAcceso = ! empty($validated['password']) || ! $usuario->hasRole($validated['role']);

        $usuario->update(collect($validated)->except('role')->all());
        $usuario->syncRoles([$validated['role']]);

        // Si cambio la clave o el rol, las sesiones abiertas (por ejemplo un
        // token robado) dejan de servir. Si quien edita es el mismo usuario se
        // conserva su sesion actual para no sacarlo del panel.
        if ($cambiaAcceso) {
            $tokens = $usuario->tokens();
            if ($request->user()->is($usuario)) {
                $tokens->where('id', '!=', $request->user()->currentAccessToken()?->id);
            }
            $tokens->delete();
        }

        return response()->json([
            'message' => 'Usuario actualizado exitosamente.',
            'usuario' => $this->conRol($usuario),
        ], 200);
    }

    public function destroy(Request $request, User $usuario)
    {
        if ($usuario->hasRole('socio')) {
            return response()->json(['message' => 'Usuario no encontrado.'], 404);
        }

        if ($request->user()->id === $usuario->id) {
            return response()->json([
                'message' => 'No puedes eliminar el usuario con el que tienes la sesion activa.',
            ], 422);
        }

        if ($usuario->hasRole('admin') && User::role('admin')->count() <= 1) {
            return response()->json([
                'message' => 'Debe existir al menos un usuario administrador.',
            ], 422);
        }

        $usuario->tokens()->delete();
        $usuario->delete();

        return response()->json(['message' => 'Usuario eliminado exitosamente.'], 200);
    }

    private function conRol(User $usuario): array
    {
        return [
            'id' => $usuario->id,
            'name' => $usuario->name,
            'email' => $usuario->email,
            'created_at' => $usuario->created_at,
            'role' => $usuario->roles->first()?->name,
        ];
    }
}
