# Usamos una imagen ligera de Node.js 20
FROM node:20-slim

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos las dependencias para producción/entorno
RUN npm install

# Copiamos el resto del código fuente (incluyendo server.js y la carpeta images/)
COPY . .

# Exponemos el puerto 3000 (Cloud Run maneja el puerto dinámico vía process.env.PORT)
EXPOSE 3000

# Comando para iniciar la app
CMD ["npm", "start"]