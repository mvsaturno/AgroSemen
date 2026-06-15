# AgroSêmen 🐄

Sistema de gerenciamento de inseminação artificial bovina com suporte **offline-first**.

---

## Estrutura do Projeto

```
AgroSemen/
├── backend/    — API REST (Fastify + Prisma + PostgreSQL)
├── mobile/     — App React Native (Expo + SQLite offline-first)
└── infra/      — Scripts de provisionamento da VM Oracle
```

---

## Stack

| Camada | Tecnologia |
|---|---|
| **API** | Node.js 22, Fastify 5, Prisma ORM, PostgreSQL |
| **Mobile** | React Native, Expo SDK 56, Drizzle ORM, SQLite |
| **Estilo** | NativeWind (Tailwind CSS para React Native) |
| **Auth** | JWT (30d) + PIN 4 dígitos + bcrypt |
| **Sync** | Delta bidirecional offline-first via `/sync` |
| **SMS** | Twilio (verificação de número no cadastro) |
| **Infra** | VM Oracle Cloud (Ubuntu), IP: 163.176.47.4 |

---

## Perfis de Usuário

- **Uso Próprio** — Produtor rural, sem cobrança de serviço
- **Prestador de Serviços** — Ginete/técnico, com campo de valor e relatórios financeiros

---

## Funcionalidades

- Cadastro de touros com foto, raça e empresa fornecedora
- Gestão de lotes de sêmen (Convencional, Sexado ♂, Sexado ♀)
- Registro de inseminações com cliente, identificação da vaca e valor cobrado
- Histórico de inseminações
- Lista de compras com exportação CSV e compartilhamento WhatsApp
- Catálogo público (`/catalogo/:slug`) para clientes fazerem reservas via WhatsApp
- Multi-tenant: cada fazenda é uma conta isolada
- Sistema de convites para equipe (Admin + Usuários)
- Funciona **100% offline** — sincroniza automaticamente quando a conexão volta

---

## Setup — Backend

```bash
cd backend
cp .env.example .env     # preencher com suas credenciais
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## Setup — Mobile

```bash
cd mobile
npm install --legacy-peer-deps
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleDebug
```

A APK ficará em `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## Variáveis de Ambiente

Ver `backend/.env.example` para referência completa.
