# How To Verify Progress

## 1) Prepare database

- PostgreSQL 실행
- 환경변수 설정

```powershell
$env:DATABASE_URL="postgres://USER:PASS@localhost:5432/stepquest"
$env:JWT_SECRET="change-this-secret"
$env:JWT_EXPIRES_IN="7d"
```

## 2) Init database

```powershell
cd C:\Users\narat\OneDrive\문서\codex\backend
npm.cmd install
npm.cmd run db:init
```

## 3) Run server

```powershell
cd C:\Users\narat\OneDrive\문서\codex\backend
npm.cmd run start:dev
```

## 4) Run automated checks

```powershell
cd C:\Users\narat\OneDrive\문서\codex\backend
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\check-progress.ps1
npm.cmd run smoke:test
```

## 5) Manual auth + API check

```powershell
$signup = Invoke-RestMethod -Method POST -Uri "http://localhost:3000/auth/signup" -ContentType "application/json" -Body '{"email":"u1@example.com","nickname":"u1","password":"Password123!"}'
$token = $signup.accessToken
$h=@{Authorization="Bearer $token"}
Invoke-RestMethod -Method GET -Uri "http://localhost:3000/player/me" -Headers $h
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/idle/claim" -Headers $h
```
