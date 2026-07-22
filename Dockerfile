# PolePole — single-image build: React frontend + .NET API served from one origin.
# Multi-stage so the final image carries only the runtime + published app.

# ---- Stage 1: build the web frontend (Vite → static files) ----
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build          # outputs /app/frontend/dist

# ---- Stage 2: build & publish the .NET backend, embedding the frontend ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY backend/SwahiliCourse.Api/*.csproj ./SwahiliCourse.Api/
RUN dotnet restore ./SwahiliCourse.Api/SwahiliCourse.Api.csproj
COPY backend/SwahiliCourse.Api/ ./SwahiliCourse.Api/
# The built frontend becomes the API's static web root.
COPY --from=frontend /app/frontend/dist ./SwahiliCourse.Api/wwwroot
RUN dotnet publish ./SwahiliCourse.Api/SwahiliCourse.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ---- Stage 3: runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=backend /app/publish ./

# Listen on 8080 (non-root friendly); persist the SQLite DB under /home/data
# (Azure App Service persists /home when WEBSITES_ENABLE_APP_SERVICE_STORAGE=true).
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DataDir=/home/data

EXPOSE 8080
ENTRYPOINT ["dotnet", "SwahiliCourse.Api.dll"]
