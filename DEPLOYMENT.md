# Guía de Instalación y Despliegue - Shopify Import System

Esta guía explica cómo ejecutar el proyecto localmente y cómo subirlo a la nube (Vercel).

## 🚀 Ejecución en Local

Si quieres abrir el proyecto en tu ordenador sin usar una IA o interfaz externa, sigue estos pasos:

1.  **Requisitos**: Asegúrate de tener instalado [Node.js](https://nodejs.org/) (versión 18 o superior).
2.  **Abrir Terminal**: Abre una terminal (PowerShell o CMD) en la carpeta del proyecto.
3.  **Instalar Dependencias**: Ejecuta el siguiente comando para instalar las librerías necesarias:
    ```bash
    npm install
    ```
4.  **Configurar Variables**: Asegúrate de tener un archivo llamado `.env.local` en la raíz con tu clave de Google:
    ```env
    GOOGLE_GENERATIVE_AI_API_KEY=tu_clave_aqui
    ```
5.  **Iniciar Servidor**: Ejecuta el comando de desarrollo:
    ```bash
    npm run dev
    ```
6.  **Acceder**: Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

## ☁️ Despliegue en la Nube (Vercel)

Para tener el proyecto accesible desde cualquier lugar y en cualquier dispositivo, lo ideal es usar **Vercel**. Es gratuito y muy fácil de conectar con GitHub.

### Pasos para Vercel:

1.  **Entrar en Vercel**: Ve a [vercel.com](https://vercel.com/) e inicia sesión con tu cuenta de GitHub.
2.  **Nuevo Proyecto**: Haz clic en **"Add New"** > **"Project"**.
3.  **Importar desde GitHub**: Verás tu repositorio `shopify-tiendas-import-system-v2`. Haz clic en **"Import"**.
4.  **Configurar Variables de Entorno (CRÍTICO)**: 
    - Antes de darle a "Deploy", busca la sección **"Environment Variables"**.
    - Añade una nueva variable:
        - **Key**: `GOOGLE_GENERATIVE_AI_API_KEY`
        - **Value**: Tu clave de la API de Gemini.
    - Haz clic en **"Add"**.
5.  **Desplegar**: Haz clic en **"Deploy"**.
6.  **¡Listo!**: En un par de minutos, Vercel te dará una URL (ej: `shopify-tiendas.vercel.app`) que podrás usar desde cualquier sitio.

---

## 🛠️ Notas Adicionales
- **Seguridad**: Nunca compartas el archivo `.env.local` ni publiques tu clave de API en repositorios públicos.
- **Actualizaciones**: Cada vez que hagas un `git push` a GitHub, Vercel actualizará tu web automáticamente.
