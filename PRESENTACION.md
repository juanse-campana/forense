# Cómo presentar este proyecto

Guía para exponer el framework de forense de APKs — pensada para hablar desde acá, no para leerla en voz alta.

---

## 1. Qué es esto, en una frase

**Una herramienta que le hace autopsia a una aplicación Android y te dice, en segundos, todo lo que un atacante ya sabría sobre ella** — permisos peligrosos, secretos hardcodeados, criptografía débil, configuraciones que dejan la puerta abierta — sin necesitar instalarla ni ejecutarla nunca.

Eso es lo primero que tenés que dejar claro: es **análisis estático**. No corremos la app, no necesitamos un celular ni un emulador. Le leemos el archivo `.apk` como quien lee una radiografía.

---

## 2. El problema que resuelve

Cualquiera puede bajar un APK, decompilarlo con `jadx` y ponerse a buscar secretos a mano — pero eso son horas de trabajo manual, módulo por módulo, cada vez. Este framework automatiza exactamente ese proceso que un analista de seguridad haría a mano: hashea el archivo, decodifica el manifest, escanea el código en busca de patrones sospechosos, mide qué tan ofuscado está, y arma un reporte.

Los casos de uso reales:
- **CTF / práctica de seguridad ofensiva**: analizar apps intencionalmente vulnerables (InjuredAndroid, DIVA, y la nuestra propia, NovaBank) para aprender a detectar fallas típicas.
- **Auditoría rápida antes de publicar una app**: ¿nos quedó `debuggable=true` en el build de release? ¿hay una API key hardcodeada que se nos escapó?
- **Investigación forense**: analizar un APK sospechoso (malware, app pirata, algo que llegó por un canal no oficial) sin arriesgarse a ejecutarlo.
- **Enseñanza**: mostrar en la práctica por qué "nunca hardcodees una contraseña" no es un consejo abstracto — acá lo ves listado con severidad CRITICAL.

---

## 3. Arquitectura — cómo está armado

Tres capas, cada una haciendo un trabajo distinto:

```
┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│   apk_forensics.py   │      │      api/ (FastAPI)   │      │    web/ (Next.js)   │
│                       │      │                        │      │                      │
│  El motor. Un script  │◄─────│  Envuelve el motor en  │◄─────│  La interfaz. Subís  │
│  Python que hace TODO │      │  una API REST: recibe  │      │  un APK, ves el      │
│  el análisis. Corre   │      │  el archivo, lo manda  │      │  progreso en vivo,   │
│  solo por consola     │      │  a analizar en segundo │      │  navegás el reporte  │
│  también, sin API ni  │      │  plano, guarda el      │      │  por pestañas        │
│  web.                 │      │  resultado en Postgres │      │                      │
└─────────────────────┘      └──────────────────────┘      └─────────────────────┘
```

**Por qué está separado así**: el motor (`apk_forensics.py`) es completamente independiente — podés usarlo desde la terminal con `python3 apk_forensics.py app.apk` y te genera reportes en HTML/JSON/Markdown sin necesitar nada más. La API y la web son una capa encima para que sea usable por alguien que no quiere tocar una terminal, con historial de análisis, subida por drag-and-drop, y un dashboard.

**Stack técnico:**

| Capa | Tecnología | Por qué |
|---|---|---|
| Motor | Python puro (stdlib + regex) | Cero dependencias pesadas, corre en cualquier lado |
| Backend | FastAPI + PostgreSQL + SQLAlchemy async | Async de punta a punta, jobs en segundo plano, progreso en vivo vía SSE |
| Frontend | Next.js 16 + React 19 + Tailwind 4 | Interfaz moderna, bilingüe (es/en), tema oscuro tipo "DevTools" |
| Herramientas externas | `apktool`, `aapt`, `jadx` | Decodifican el manifest binario y decompilan el código — el motor las invoca, no las reinventa |

**Un detalle técnico que vale la pena mencionar si preguntan**: `apktool`/`aapt`/`jadx` necesitan correr en un entorno Linux/WSL — en Windows nativo esas herramientas no se pueden invocar correctamente, así que el análisis completo (manifest, secretos, cripto) requiere WSL. Es una limitación documentada, no un bug escondido.

---

## 4. Qué analiza — los 7 módulos

Este es el corazón de la demo. Cada módulo responde una pregunta de seguridad concreta:

| # | Módulo | Qué pregunta responde |
|---|---|---|
| 1 | **Hashes** (MD5/SHA-256) | "¿Es exactamente el mismo archivo que ya vimos, o alguien lo modificó?" — huella digital forense |
| 2 | **Estructura del ZIP** | "¿Qué hay adentro?" — DEX, librerías nativas (.so), archivos de interés forense (.db, .pem, .key) |
| 3 | **AndroidManifest** | "¿Está mal configurada la app?" — `debuggable=true` (se le puede enchufar un debugger en producción), `allowBackup=true` (se pueden extraer los datos con `adb backup` sin root), componentes exportados sin permiso |
| 4 | **Secretos hardcodeados** | "¿Se les escapó algo?" — passwords, API keys, credenciales de AWS, claves privadas, connection strings a bases de datos, todo vía regex sobre el código decompilado |
| 5 | **Criptografía** | "¿Usan algoritmos rotos?" — MD5/SHA1 para integridad, modo ECB (revela patrones), o si usan TrustManager/CertificatePinner vacíos (sin protección real contra ataques man-in-the-middle) |
| 6 | **Ofuscación** | "¿Qué tan difícil es leer este código para un atacante?" — score 0-100 combinando nombres de clase acortados (ProGuard/R8), uso de reflection, y carga dinámica de código (`DexClassLoader`) |
| 7 | **Decompilación (JADX)** | Convierte el DEX de vuelta a Java legible, para poder re-escanear con más contexto y para que el explorador de código de la web sea navegable |

**La frase clave para explicar esto**: "no es magia, es heurística" — cada hallazgo es una señal de que algo AMERITA revisión humana, no una certeza matemática. Por eso cada uno tiene una severidad (CRITICAL / HIGH / MEDIUM / LOW / INFO), no un veredicto binario de "seguro/inseguro".

---

## 5. Qué te devuelve — los resultados

**Tres formatos de reporte**, generados siempre: JSON (para integrar con otra herramienta), HTML (para mandarle a alguien que no usa la terminal), y Markdown (para pegar en un ticket o documentación).

**En la web**, el resultado se navega por pestañas:

- **Resumen** — metadata (paquete, versión, hashes, SDK mínimo/objetivo), conteo de componentes, librerías nativas
- **Hallazgos** — la lista completa, filtrable por severidad, con conteo de cuántos hay de cada una arriba de todo (para que el riesgo se vea de un vistazo, sin tener que clickear)
- **Permisos** — separados en "peligrosos" (los que de verdad importan: SMS, contactos, cámara, ubicación) vs. el listado completo
- **Criptografía** — qué algoritmos se usan, marcando en rojo los débiles
- **Estructura** — inventario de archivos con tamaño real
- **Manifest** — el texto crudo, más los flags de `debuggable`/`allowBackup` explicados con un tooltip (para que no haga falta saber qué significan de antemano)
- **Ofuscación** — el score con la interpretación (bajo/moderado/alto) y qué indicadores lo dispararon

También hay **Historial** (todos los análisis pasados, ordenable por columna) y un **Dashboard** con estadísticas agregadas (total de análisis, hallazgos críticos, ofuscación promedio).

---

## 6. Para la demo en vivo

Usá `novabank-demo-vulnerable.apk` (está en la raíz del repo) — es un APK mínimo armado a propósito, con una app ficticia ("NovaBank", sin librerías reales de terceros), pensado exactamente para esto: dispara **68 hallazgos limpios** (12 CRITICAL, 19 HIGH, 12 MEDIUM, 25 LOW) sin el ruido de una app real grande.

**Guión sugerido:**

1. Arrancá en la pantalla de carga — arrastrá el APK, mostrá la barra de progreso en vivo (7 pasos, con nombre de cada uno).
2. Andá directo a la pestaña **Manifest** — mostrá `debuggable: Sí` y explicá en una frase qué significa ("cualquiera puede engancharle un debugger a esta app en producción").
3. Pasá a **Permisos** — señalá los peligrosos (SMS, cámara, ubicación) y preguntá retóricamente: "¿por qué una app de banco pide leer tus SMS?"
4. Andá a **Hallazgos**, filtrá por CRITICAL — ahí están la password hardcodeada, las credenciales de AWS, la clave privada RSA embebida. Esto es lo que más impacta visualmente.
5. Cerrá con **Ofuscación** — score 30/100, y explicá que detectamos carga dinámica de código (`DexClassLoader`), la misma técnica que usa malware real para evadir escaneos automáticos.
6. Si hay tiempo: mostrá el botón de exportar (JSON/HTML/MD) — "esto se lo mandás a quien tenga que arreglarlo, sin que necesite instalar nada".

---

## 7. Preguntas que probablemente te hagan (y cómo responderlas)

**"¿Esto reemplaza un pentest completo?"**
No — es la primera pasada, automática y rápida. Te dice DÓNDE mirar. Un pentest completo incluye análisis dinámico (correr la app, interceptar tráfico), esto es solo la mitad estática — aunque es la mitad que se puede automatizar al 100%.

**"¿Cómo sé que un hallazgo es real y no un falso positivo?"**
Buena pregunta, y honesta: algunos patrones (como el de "posible secreto en base64") son deliberadamente amplios y van a marcar cosas que no son secretos reales. Por eso cada hallazgo trae evidencia (el archivo, la línea, un fragmento) — el objetivo es reducir dónde mirar, no reemplazar el criterio humano.

**"¿Funciona con cualquier APK?"**
Sí, aunque el nivel de detalle depende de si están instaladas las herramientas externas (`apktool`/`aapt`/`jadx`). Sin ellas, igual sacás hashes y estructura del ZIP — con ellas, el análisis es completo.

**"¿Por qué no usan [MobSF / herramienta comercial]?"**
Porque el objetivo acá era construir el motor de análisis desde cero, entendiendo cada heurística — no integrar una caja negra. MobSF está mencionado en el roadmap como opción complementaria para análisis más profundo, no como reemplazo.

---

## 8. Una frase para cerrar

*"No hace falta ser un reverse engineer para saber que una app de banco no debería tener una contraseña de admin hardcodeada en el código — esta herramienta lo encuentra en segundos, con evidencia, y te dice exactamente dónde mirar."*
