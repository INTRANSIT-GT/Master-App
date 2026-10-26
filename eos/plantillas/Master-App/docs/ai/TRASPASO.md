# TRASPASO · Transportes (Master App)

Registro cronológico. Cada entrada separa propuesto, preparado, ejecutado, verificado y aprobado.

## 2026-10-25 · Configuración local de Claude

**Solicitud:** Ing. Carmen entregó el paquete de inicio v1.0 y autorizó: (1) preparar los archivos, clonando los repos reales; (2) hacerlo en OP y en Master App; (3) mantener los repos públicos por el momento; (4) tratar Supabase `bocgzjupocnvjehklxhs` como prueba.

**Alcance:** solo archivos locales en este clon. Sin commit, push, Supabase ni corrección de defectos.

- **Propuesto:** el paquete v1.0 (preparado por Codex; es una propuesta, no una certificación).
- **Preparado:** `AGENTS.md`, `CLAUDE.md`, `docs/ai/{ESTADO,TRASPASO,FUENTES,SEGURIDAD}.md`, `scripts/intransit-startup.cjs`, `.claude/settings.json` (hook `SessionStart` en forma exec `node` + `args`, sin matcher), `.claude/skills/intransit-trazabilidad/SKILL.md`, tres líneas nuevas al final de `.gitignore`.
- **Ejecutado:** clon `a09bacb` (107 commits); búsqueda del host de Supabase en el código (1 referencia: `bocgzjupocnvjehklxhs`); prueba manual del script del hook.
- **Verificado:** ver la sección de pruebas abajo.
- **Aprobado:** nada de lo anterior está aprobado para commit o publicación.

**Pruebas:** ver la entrada «Prueba del hook» al final de este archivo.

**Pendientes:** prueba en sesión nueva; decidir el commit de estos archivos; confirmar el entorno real de Supabase; revalidar los hallazgos heredados solo si Ing. Carmen lo encarga.

### Prueba del hook · 2026-10-25 · Windows 11, Node 22.23.4, Git Bash
Comando: `node scripts/intransit-startup.cjs` con JSON sintético por stdin, en OP y en Master App.

| Caso | Resultado |
|---|---|
| `node --check` | PASA |
| `source: startup`, `compact`, `resume` | PASA: recibo con evento, app, rama, SHA, hashes y `missing: []`; salida ≈ 2 900 caracteres |
| stdin vacío | PASA: `event: PRUEBA_MANUAL` |
| JSON inválido | PASA: no falla (exit 0) |
| Ruta con espacios, sin Git y sin archivos | PASA: 4 archivos `FALTANTE`, `NO_VERIFICADO` en rama/SHA/dirty (corregido el conteo de `dirty` fuera de Git) |
| ESTADO de 9 000 caracteres | PASA: se trunca a 6 000 con aviso; salida total < 10 000 (límite de Claude Code) |
| Lectura de `.env`, Excel o red | NO lo hace (revisión del código) |
| Datos del Excel o secretos en los archivos preparados | Ninguno (búsqueda de términos del libro y patrones de claves) |

**No verificado aquí:** ejecución real del hook por Claude Code en una sesión nueva, `/context`, `/hooks`, descubrimiento de la skill. Estado: pendiente de prueba en el Claude de Carmen.
