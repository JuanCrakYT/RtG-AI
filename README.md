# RtG-AI

**RtG-AI** es un proyecto experimental de inteligencia artificial especializado en **Road to Gramby's**, cuyo objetivo es crear una IA capaz de comprender las piezas, conexiones y estructuras del juego y generar builds válidas de Road to Gramby's a partir de lenguaje natural.

> **Describe lo que quieres construir. RtG-AI se encarga de convertirlo en una build.**

El proyecto está diseñado para evolucionar desde una interfaz de chat experimental hasta un sistema de IA generativa especializado en el formato de builds de RtG.

---

## 🚧 Estado del proyecto

**En desarrollo activo.**

Actualmente el proyecto se encuentra en la etapa de construcción de la aplicación y preparación de la arquitectura necesaria para incorporar un modelo de IA real.

La aplicación ya cuenta con:

* Interfaz de chat.
* Conversaciones persistentes localmente.
* Selector de modelos.
* Sistema de preview de builds.
* Integración con `RtG-Preview`.
* Prompts sugeridos.
* Soporte preparado para múltiples idiomas.
* Sistema inicial de feedback.
* Arquitectura separada entre interfaz, lógica de aplicación y modelo.
* Modelo mock para probar el funcionamiento de la aplicación.

El modelo actual **no es una IA generativa real**. El comportamiento actual sirve únicamente para desarrollar y probar la aplicación mientras se construye el sistema de IA.

---

## 🎯 Objetivo

El objetivo final de RtG-AI es desarrollar una IA capaz de interpretar solicitudes como:

> "Hazme un vehículo con cuatro ruedas, un asiento y un motor."

y producir una build de RtG válida que pueda ser visualizada y posteriormente utilizada en el ecosistema de `RtG-Format`.

La IA deberá comprender conceptos como:

* Piezas.
* Propiedades.
* Conexiones.
* Puntos de conexión.
* UUIDs.
* CFrames.
* Estructuras de builds.
* Propiedades específicas de cada objeto.
* Relaciones entre diferentes piezas.

La intención no es crear un sistema de reglas que simplemente convierta frases predefinidas en JSON.

**RtG-AI debe ser una IA generativa especializada en RtG.**

---

## 🔗 RtG-Format

RtG-AI utiliza el ecosistema de [`RtG-Format`](https://github.com/JuanCrakYT/RtG-Format) como referencia para la estructura de las builds.

`RtG-Format` documenta el formato utilizado para representar builds de Road to Gramby's y proporciona herramientas relacionadas con dicho formato, incluyendo `RtG-Preview`.

RtG-AI no debe inventar su propio formato de builds.

La generación de builds debe respetar el formato documentado por `RtG-Format`.

---

## 🖥️ Aplicación

La aplicación web se encuentra dentro de:

```text
app/
```

La interfaz está desarrollada utilizando tecnologías web estándar:

* HTML
* CSS
* JavaScript
* JSON

No utiliza frameworks frontend.

La aplicación está diseñada para ser sencilla y servir como interfaz para el sistema de IA.

### Estructura

```text
app/
├── src/
│   ├── core/
│   │   ├── ai.js
│   │   ├── chatManager.js
│   │   ├── feedback.js
│   │   ├── modelManager.js
│   │   └── storage.js
│   │
│   ├── ui/
│   │   ├── chat.js
│   │   ├── feedback.js
│   │   ├── input.js
│   │   ├── message.js
│   │   ├── modelSelector.js
│   │   ├── preview.js
│   │   ├── sidebar.js
│   │   └── suggested.json
│   │
│   └── main.js
│
├── styles/
│   └── main.css
│
├── index.html
├── lang.json
└── package.json
```

### Separación de responsabilidades

El proyecto mantiene separadas las diferentes partes de la aplicación.

```text
UI
│
├── Chat
├── Input
├── Sidebar
├── Preview
└── Model Selector
        │
        ▼
      Core
        │
        ├── AI
        ├── Chat Manager
        ├── Model Manager
        ├── Storage
        └── Feedback
```

Esto permite reemplazar el modelo utilizado por la aplicación sin tener que reconstruir toda la interfaz.

---

## 🤖 Modelo de IA

Durante el desarrollo se utiliza un modelo **mock**.

Su propósito es permitir probar:

* Envío de mensajes.
* Generación de respuestas.
* Creación de conversaciones.
* Visualización de builds.
* Integración con el preview.
* Selección de modelos.
* Flujo general de la aplicación.

El modelo mock **no representa el sistema de IA final**.

La arquitectura está preparada para sustituirlo posteriormente por un modelo generativo real.

---

## 🧠 Arquitectura futura

La arquitectura prevista para el sistema final separa la interfaz del runtime del modelo:

```text
┌──────────────┐
│      UI      │
│   RtG-AI     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Model Manager│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ C++ Runtime  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ GGUF Model   │
└──────────────┘
```

Esta arquitectura todavía se encuentra en desarrollo y puede cambiar a medida que avance la investigación.

---

## 📚 Datos de desarrollo

Los datos utilizados durante la investigación y desarrollo se encuentran principalmente en:

```text
dev/
```

Esta carpeta contiene elementos como:

```text
dev/
├── checkpoints/
├── config/
├── dataset/
├── extractor/
├── feedback/
├── json/
├── logs/
├── tokens/
├── JSON-list.tree
└── tokens.json
```

Estos archivos forman parte del proceso experimental de desarrollo del modelo.

Los JSON de `dev/json/` representan datos utilizados para investigación, pruebas y preparación del sistema de IA.

No deben confundirse con reglas hardcodeadas dentro de la aplicación.

---

## 🌐 Idiomas

Los textos de la interfaz se encuentran separados de la lógica mediante:

```text
app/lang.json
```

El sistema está siendo preparado para soportar múltiples idiomas sin tener que modificar directamente la lógica de la interfaz.

Los prompts sugeridos utilizan su propio archivo de datos:

```text
app/src/ui/suggested.json
```

De esta manera, agregar o modificar prompts no requiere modificar el código de la interfaz.

---

## 👁️ Preview

RtG-AI integra el sistema oficial de preview de `RtG-Format` para visualizar builds generadas por la aplicación.

El preview permite comprobar visualmente las estructuras generadas por la IA antes de utilizarlas fuera de la aplicación.

La integración se mantiene separada del sistema de generación para que el preview no sea responsable de construir o interpretar las reglas de generación de la IA.

---

## 💾 Persistencia

La aplicación utiliza almacenamiento local durante la etapa actual de desarrollo.

Esto permite conservar información como:

* Conversaciones.
* Modelo seleccionado.
* Datos de la aplicación.

La persistencia local podrá ser reemplazada o complementada posteriormente cuando exista un servidor.

---

## 🛣️ Roadmap

### Fase 1 — Aplicación

* [x] Interfaz inicial.
* [x] Chat.
* [x] Sidebar.
* [x] Conversaciones.
* [x] Selector de modelo.
* [x] Preview.
* [x] Prompts sugeridos.
* [x] Sistema inicial de feedback.
* [x] Preparación para múltiples idiomas.
* [ ] Pulido final de la UI.

### Fase 2 — Primer modelo

* [ ] Integración con un modelo de IA real.
* [ ] Primer sistema generativo especializado en RtG.
* [ ] Pruebas con builds reales.
* [ ] Evaluación de calidad de las generaciones.

### Fase 3 — Backend

* [ ] Crear servidor.
* [ ] Comunicación entre la aplicación y el modelo.
* [ ] Gestión de sesiones.
* [ ] Sistema de feedback conectado al servidor.
* [ ] Infraestructura para ejecutar el modelo.

### Fase 4 — Runtime especializado

* [ ] Runtime dedicado.
* [ ] Integración con modelos GGUF.
* [ ] Optimización de inferencia.
* [ ] Ejecución local.
* [ ] Reducción del consumo de recursos.

### Fase 5 — IA especializada en RtG

* [ ] Dataset especializado.
* [ ] Entrenamiento / fine-tuning.
* [ ] Evaluación automática de builds.
* [ ] Generación de estructuras complejas.
* [ ] Mejor comprensión de conexiones y geometría.
* [ ] Validación automática de builds.

---

## 🔬 Filosofía del proyecto

RtG-AI no pretende ser simplemente un chatbot que conoce algunos nombres de piezas.

El objetivo es construir una IA que pueda **razonar sobre builds de Road to Gramby's**.

Esto significa que una generación correcta no consiste únicamente en producir JSON válido.

También debe:

1. Comprender qué quiere construir el usuario.
2. Selecci
