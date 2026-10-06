# Product Requirements Document

## Laundry Shoe Management PWA

**Document Version:** 1.0  
**Product Type:** Progressive Web App (PWA)  
**Target Platform:** Mobile Web, Android, iOS, Tablet, Desktop  
**Primary Users:** Owner laundry sepatu, kasir/admin, staff operasional  
**Initial Market:** Usaha laundry sepatu skala kecil–menengah di Indonesia

---

# 1. Product Overview

Laundry Shoe Management PWA adalah aplikasi operasional berbasis web untuk membantu usaha laundry sepatu mengelola proses bisnis dari order masuk sampai sepatu selesai dan diambil pelanggan.

Aplikasi dirancang sebagai alternatif yang lebih ringan dan terjangkau dibanding aplikasi POS laundry yang sudah ada, dengan fokus pada fitur yang benar-benar digunakan dalam operasional sehari-hari.

Aplikasi dapat diakses melalui browser dan dipasang ke Home Screen sebagai PWA tanpa perlu mengunduh aplikasi dari Play Store atau App Store.

Contoh:

```
app.laundryku.id
```

User dapat melakukan:

```
Buka URL
→ Login
→ Add to Home Screen
→ Aplikasi tampil seperti native app
```

---

# 2. Problem Statement

Laundry sepatu kecil biasanya menghadapi beberapa masalah:

1. Pencatatan order masih melalui WhatsApp atau buku.
2. Sulit mengetahui status setiap sepatu.
3. Tidak ada histori customer yang terstruktur.
4. Sulit mengetahui order yang terlambat.
5. Pelanggan sering menanyakan status pengerjaan.
6. Rekap omzet masih manual.
7. Foto kondisi sepatu sebelum dan sesudah treatment tidak terorganisir.
8. Software POS khusus laundry dianggap terlalu mahal atau memiliki banyak fitur yang tidak diperlukan.
9. Pemilik usaha membutuhkan sistem yang sederhana dan dapat digunakan langsung dari HP.

---

# 3. Product Goal

Membuat aplikasi laundry sepatu yang:

- mudah digunakan,
- murah untuk dijalankan,
- mobile-first,
- dapat diinstall sebagai PWA,
- membantu mengurangi pencatatan manual,
- memperjelas status pengerjaan,
- meningkatkan pelayanan customer,
- menyediakan laporan bisnis sederhana.

---

# 4. Non-Goals

Untuk MVP, aplikasi belum ditujukan untuk:

- accounting lengkap,
- payroll,
- marketplace,
- delivery fleet management,
- integrasi ERP,
- multi-country,
- native Bluetooth printer kompleks,
- AI recommendation,
- franchise management kompleks,
- inventory warehouse kompleks.

Fitur tersebut dapat masuk roadmap setelah validasi pasar.

---

# 5. Target User

## 5.1 Owner

Pemilik usaha yang ingin melihat:

- omzet,
- jumlah order,
- pekerjaan aktif,
- order terlambat,
- pembayaran,
- performa bisnis.

---

## 5.2 Admin / Kasir

Bertugas:

- membuat order,
- input customer,
- menerima pembayaran,
- upload foto,
- mencetak/mengirim invoice,
- mengubah status order.

---

## 5.3 Staff Laundry

Bertugas:

- melihat pekerjaan,
- mengubah status pengerjaan,
- melihat catatan treatment,
- upload foto hasil pekerjaan.

---

# 6. Core User Flow

```
Customer datang
      ↓
Admin cari / buat customer
      ↓
Tambah order
      ↓
Tambah sepatu
      ↓
Pilih treatment
      ↓
Foto kondisi sepatu
      ↓
Hitung harga
      ↓
Order dibuat
      ↓
Received
      ↓
Washing
      ↓
Drying
      ↓
Quality Check
      ↓
Ready for Pickup
      ↓
Customer mendapat notifikasi
      ↓
Pembayaran
      ↓
Completed
```

---

# 7. Order Status

Status utama:

```
RECEIVED
WASHING
DRYING
QUALITY_CHECK
READY
COMPLETED
CANCELLED
```

Optional:

```
WAITING_PAYMENT
PICKED_UP
PROBLEM
```

Setiap perubahan status harus memiliki:

- timestamp,
- user yang melakukan perubahan,
- catatan optional.

---

# 8. MVP Features

## 8.1 Authentication

User dapat login menggunakan:

- email,
- username,
- password.

Role awal:

```
OWNER
ADMIN
STAFF
```

Permissions:

### OWNER

Full access.

### ADMIN

Order, customer, payment, report dasar.

### STAFF

Order dan update workflow.

---

# 9. Dashboard

Dashboard menampilkan informasi utama.

Contoh:

```
Good Morning

Today's Revenue
Rp750.000

Orders Today
12

Active Orders
23

Ready for Pickup
6

Overdue
3
```

Quick actions:

```
+ New Order
Search Order
Ready Pickup
Today's Work
```

---

# 10. Customer Management

Data customer:

```
Customer ID
Name
Phone Number
Email optional
Address optional
Notes
Created At
```

Customer detail menampilkan:

- total order,
- total spending,
- active order,
- order history.

Search berdasarkan:

- nama,
- nomor HP.

---

# 11. Service Management

Owner dapat membuat treatment.

Contoh:

```
Fast Clean
Rp35.000

Deep Clean
Rp50.000

Unyellowing
Rp75.000

Repaint
Rp100.000
```

Data service:

```
Name
Description
Price
Estimated Duration
Active
```

Service dapat dinonaktifkan tanpa menghapus history.

---

# 12. Order Management

Order memiliki:

```
Order Number
Customer
Order Date
Estimated Completion
Status
Subtotal
Discount
Total
Payment Status
Notes
Created By
```

Contoh order number:

```
ORD-2026-000123
```

---

# 13. Shoe / Item Management

Satu order dapat memiliki lebih dari satu item.

Contoh:

```
Order ORD-2026-000123

1. Nike Air Force 1
   Deep Clean
   Rp50.000

2. Adidas Samba
   Fast Clean
   Rp35.000
```

Data item:

```
Brand
Model
Color
Size optional
Service
Price
Condition Notes
Special Request
```

---

# 14. Photo Documentation

Admin dapat mengambil foto langsung menggunakan kamera HP.

Kategori:

```
Before
After
Problem
```

Contoh:

```
Nike Air Force 1

Before
[photo]
[photo]

After
[photo]
[photo]
```

Foto disimpan ke object storage.

---

# 15. Work Queue

Staff melihat daftar pekerjaan.

Contoh:

```
Today's Work

WASHING
#ORD-00123
Nike Air Force 1

DRYING
#ORD-00118
Adidas Samba

QUALITY CHECK
#ORD-00112
New Balance 530
```

Filter:

```
All
Received
Washing
Drying
QC
Ready
```

---

# 16. SLA / Overdue Detection

Order dianggap overdue ketika:

```
Current Time > Estimated Completion
AND
Status != COMPLETED
```

UI:

```
⚠ Overdue

ORD-00115
Nike Dunk Low

Due:
Yesterday 17:00
```

Dashboard menampilkan jumlah order overdue.

---

# 17. Payment

Payment status:

```
UNPAID
PARTIAL
PAID
REFUNDED
```

Payment method:

```
Cash
QRIS
Transfer
E-Wallet
Other
```

Data:

```
Amount
Method
Payment Date
Reference Number optional
```

MVP belum perlu payment gateway.

QRIS dapat berupa QR milik merchant.

---

# 18. Invoice / Receipt

Setelah order dibuat, sistem menghasilkan invoice digital.

Invoice berisi:

```
Laundry Name
Order Number
Customer
Items
Services
Price
Discount
Total
Payment Status
Estimated Completion
```

Actions:

```
View
Download PDF
Share
WhatsApp
```

---

# 19. WhatsApp Integration

MVP menggunakan WhatsApp deep link.

Contoh:

```
https://wa.me/{phone}
```

Template:

```
Halo Budi,

Sepatu Nike Air Force 1 Anda sudah selesai dan siap diambil.

Order:
ORD-2026-00123

Total:
Rp50.000

Terima kasih.
```

Phase berikutnya dapat menggunakan WhatsApp Business API.

---

# 20. Customer Tracking

Customer tidak perlu login.

Customer dapat membuka:

```
laundryku.id/track/ORD-XXXX
```

atau menggunakan secure tracking token.

UI:

```
Nike Air Force 1

✓ Order Received
✓ Washing
● Drying
○ Quality Check
○ Ready for Pickup

Estimated completion:
7 October 2026
```

Customer juga dapat melihat:

- total,
- payment status,
- outlet,
- contact.

Tidak menampilkan data sensitif internal.

---

# 21. Reporting

MVP report:

## Daily Revenue

```
Revenue Today
Rp1.250.000
```

## Order Statistics

```
Orders Today
15

Completed
10

Active
5
```

## Payment Method

```
Cash     Rp450.000
QRIS     Rp600.000
Transfer Rp200.000
```

## Popular Service

```
Deep Clean
42 orders
```

Filter:

```
Today
Yesterday
7 Days
30 Days
Custom Range
```

---

# 22. Search

Global search dapat mencari:

```
Order Number
Customer Name
Phone Number
Shoe Brand
```

Contoh:

```
Search:
081234567890
```

Hasil:

```
Budi Santoso

ORD-00120
Completed

ORD-00147
Washing
```

---

# 23. PWA Requirements

Aplikasi harus:

- responsive,
- mobile-first,
- installable,
- memiliki manifest.json,
- menggunakan HTTPS,
- memiliki service worker,
- memiliki app icon,
- support Add to Home Screen.

Display:

```
standalone
```

Sehingga ketika dibuka dari Home Screen tidak terlihat seperti tab browser biasa.

---

# 24. Offline Strategy

MVP tidak harus fully offline.

Cache:

- app shell,
- static assets,
- basic UI.

Optional phase berikutnya:

```
Offline Order Queue
        ↓
Local IndexedDB
        ↓
Internet Available
        ↓
Sync API
```

Untuk mencegah duplicate order diperlukan:

```
client_generated_id
```

atau idempotency key.

---

# 25. Multi-Tenant Architecture

Walaupun customer pertama hanya satu laundry, backend harus sejak awal mendukung multi-tenant.

Struktur:

```
Tenant
 ├── Users
 ├── Customers
 ├── Services
 ├── Orders
 └── Payments
```

Setiap data memiliki:

```
tenant_id
```

Contoh:

```
orders

id
tenant_id
customer_id
order_number
status
total
```

Ini memungkinkan produk nantinya dijual ke banyak laundry tanpa membuat deployment terpisah.

---

# 26. Database Entities

Core entities:

```
Tenant
User
Role

Customer

Service

Order
OrderItem
OrderStatusHistory

ItemPhoto

Payment

Outlet

Notification
```

Relationship:

```
Tenant
 ├── Users
 ├── Customers
 ├── Services
 └── Orders
       ├── OrderItems
       │    └── Photos
       │
       ├── StatusHistory
       │
       └── Payments
```

---

# 27. Suggested Tech Stack

## Frontend

```
Next.js
TypeScript
Tailwind CSS
PWA
```

Optional UI:

```
shadcn/ui
```

---

## Backend

Option recommended:

```
NestJS
TypeScript
```

Alternative:

```
ASP.NET Core
```

---

## Database

```
PostgreSQL
```

ORM:

```
Prisma
```

atau:

```
Drizzle ORM
```

---

## Storage

S3-compatible object storage.

Contoh:

```
Cloudflare R2
AWS S3
MinIO
```

Digunakan untuk:

```
before photo
after photo
invoice
logo
```

---

# 28. Proposed Architecture

```
               Customer
                   │
             Tracking Page
                   │
                   ▼
┌────────────────────────────┐
│        Next.js PWA         │
│                            │
│ Owner / Admin / Staff      │
└──────────────┬─────────────┘
               │
             HTTPS
               │
               ▼
┌────────────────────────────┐
│        NestJS API          │
│                            │
│ Auth                       │
│ Order                      │
│ Customer                   │
│ Payment                    │
│ Reporting                  │
└─────────┬─────────┬────────┘
          │         │
          ▼         ▼
     PostgreSQL    S3/R2
                    │
                   Photos
```

---

# 29. Main Screens

Bottom navigation mobile:

```
Home
Orders
+ Order
Customers
More
```

Screens:

```
/login

/dashboard

/orders
/orders/new
/orders/:id

/customers
/customers/:id

/services

/payments

/reports

/team

/settings
```

Public:

```
/track/:token
```

---

# 30. New Order UX

Order creation harus bisa selesai dengan cepat.

Flow:

```
New Order

1. Customer
   [Search phone]
   [+ New Customer]

2. Add Item
   Brand
   Model
   Service

3. Take Photo

4. Price

5. Estimated Finish

6. Payment
   Pay Now / Later

[Create Order]
```

Target:

> Order sederhana harus dapat dibuat dalam kurang dari 1 menit.

---

# 31. Security Requirements

Password:

```
Argon2
```

atau bcrypt.

Authentication:

```
HTTP-only secure cookie
```

atau access/refresh token yang aman.

Setiap API harus memvalidasi:

```
user_id
tenant_id
role
```

User tidak boleh dapat mengakses tenant lain.

Object storage menggunakan:

```
signed URL
```

untuk file private.

---

# 32. Audit Trail

Aktivitas penting disimpan.

Contoh:

```
Admin A
changed order ORD-0012
WASHING → DRYING
10:45
```

Audit untuk:

- status,
- payment,
- price,
- order cancellation.

---

# 33. Performance Requirements

Target:

```
Initial page load:
< 2.5 seconds

API common operations:
< 500 ms

Search:
< 1 second
```

Dashboard tidak boleh membutuhkan query berat tanpa indexing.

Index minimal:

```
tenant_id
order_number
customer_id
status
created_at
phone
```

---

# 34. SaaS Pricing Readiness

Sistem harus dapat mendukung subscription.

Contoh plan:

```
Founding
Rp29.000 / month

Starter
Rp49.000 / month

Pro
Rp99.000 / month
```

Belum perlu payment automation pada MVP.

Owner platform dapat mengaktifkan subscription secara manual.

Future:

```
Midtrans
Xendit
```

---

# 35. MVP Scope

## Must Have

```
Authentication
Dashboard
Customer
Service
Order
Order Item
Photo
Workflow Status
Payment
Invoice
WhatsApp Share
Tracking Page
Basic Report
PWA Install
Multi Tenant
```

## Should Have

```
SLA / overdue
Discount
Search
Role permission
Activity history
```

## Could Have

```
Inventory
Printer
QRIS dynamic
WhatsApp API
Pickup delivery
Membership
Loyalty
Multiple outlets
```

---

# 36. Future Roadmap

## Phase 2

```
Inventory
Multiple Outlet
Employee Performance
Automatic WhatsApp
QRIS Payment Gateway
Advanced Reporting
```

## Phase 3

```
Android App
iOS App
Bluetooth Printer
Push Notification
Offline-first
```

## Phase 4

```
Pickup & Delivery
Customer App
Membership
Loyalty
Franchise Management
API Integration
```

---

# 37. MVP Success Metrics

Untuk pilot laundry pertama:

### Operational

```
>90% order dicatat melalui sistem
```

### Adoption

```
Owner menggunakan dashboard setiap hari
```

### Efficiency

Order creation:

```
< 1 minute
```

### Data

Tidak ada order aktif yang hanya tercatat melalui chat/buku.

### Customer Experience

Customer dapat mengetahui status tanpa harus bertanya melalui WhatsApp.

---

# 38. Validation Plan

Gunakan satu laundry sebagai pilot.

Observasi selama 30 hari:

```
Berapa order/hari?
Fitur mana paling sering dipakai?
Step mana yang terasa ribet?
Berapa banyak customer mengecek tracking?
Berapa banyak WhatsApp status yang dikirim?
Apakah owner menggunakan report?
```

Setiap request fitur dicatat sebagai:

```
Problem
Frequency
Impact
Requested Solution
```

Jangan langsung membuat semua request.

Prioritaskan masalah yang:

```
sering terjadi
+
berdampak besar
+
berpotensi terjadi di laundry lain
```

---

# 39. Initial Development Milestones

## Milestone 1 — Foundation

```
Project setup
Database
Multi tenant
Authentication
Roles
PWA
```

## Milestone 2 — Core Business

```
Customer
Services
Orders
Order Items
Status Workflow
```

## Milestone 3 — Operations

```
Photos
Payments
Invoice
Tracking
WhatsApp
```

## Milestone 4 — Business Dashboard

```
Dashboard
Reports
Overdue
Search
```

## Milestone 5 — Pilot

```
Deploy
Import initial services
Create account
Testing
Real usage
Bug fixing
```

---

# 40. Definition of MVP Done

MVP dianggap selesai ketika owner laundry dapat menjalankan satu transaksi lengkap:

```
Customer datang
↓
Order dibuat
↓
Sepatu difoto
↓
Treatment dipilih
↓
Staff update progress
↓
Sepatu selesai
↓
Customer mendapat informasi
↓
Pembayaran dicatat
↓
Order completed
↓
Revenue muncul di report
```

Semua proses tersebut dapat dilakukan dari smartphone tanpa aplikasi native.

---

# 41. Product Principle

Prioritas utama:

```
Fast
Simple
Reliable
Affordable
```

Produk tidak bertujuan memiliki sebanyak mungkin fitur.

Produk harus membuat aktivitas operasional laundry lebih sederhana daripada menggunakan WhatsApp, spreadsheet, atau pencatatan manual.

Prinsip utama:

> Jika sebuah fitur tidak membantu owner atau staff menyelesaikan pekerjaan lebih cepat, fitur tersebut tidak masuk MVP.