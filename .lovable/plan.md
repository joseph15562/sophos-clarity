
# Sophos Config Document Generator

A simple web app where MSPs upload their Sophos Config Viewer HTML export, and AI transforms it into a clean, professional, human-readable document describing the entire firewall setup.

## How It Works (User Flow)

1. **Upload Page** — User drags & drops (or browses for) their Sophos Config Viewer HTML export file
2. **Branding Setup** — User optionally adds their MSP company name and logo
3. **AI Processing** — The app reads the HTML config file, sends it to AI (Lovable AI), which interprets every section (interfaces, firewall rules, NAT, VPN, DHCP, DNS, routing, etc.) and writes it out in plain English
4. **Document Preview** — A beautifully formatted, printable document is shown on screen, organized by section with clear headings, descriptions, and settings explained in IT-admin-friendly language
5. **PDF Download** — User can download the document as a branded PDF

## Document Sections (AI-generated from config)

The AI will parse and describe sections like:
- **Network Interfaces & Zones** — IPs, VLANs, bridge configs
- **Firewall Rules** — Source, destination, services, actions explained in plain English
- **NAT Rules** — Port forwards, masquerading
- **VPN Configuration** — IPsec, SSL VPN, remote access
- **DHCP & DNS Settings**
- **Web Filtering & Application Control Policies**
- **Routing** — Static routes, SD-WAN
- **Authentication & User Settings**
- **System Settings** — Admin access, logging, alerts

Each section will explain what's configured and why it matters, so another IT admin could replicate it on a fresh Sophos firewall.

## Key Features

- **File upload** for Sophos Config Viewer HTML exports
- **MSP branding** — add company logo and name to the output document
- **AI-powered translation** of raw config into readable English documentation
- **On-screen preview** with clean formatting and print-friendly layout
- **PDF download** with branding included
- **No login required** — simple, instant tool

## Tech Approach

- Frontend-only upload & preview UI
- Lovable Cloud backend with an edge function calling Lovable AI to interpret the config
- Client-side PDF generation for download
