# NullReceiver IoC Sentinel 🛡️

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-black?style=for-the-badge&logo=vercel)](https://nullreceiver-monitor.vercel.app)
[![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Ethereum](https://img.shields.io/badge/Ethereum-Mainnet-3C3C3D?style=for-the-badge&logo=ethereum)](https://etherscan.io/)

> **Real-time Threat Intelligence Monitor and Byte Dissector for Ethereum-based Command-and-Control (C2) Dead-Drop Resolvers.**

🌐 **Live Production Dashboard**: [https://nullreceiver-monitor.vercel.app](https://nullreceiver-monitor.vercel.app)

---

## 🎯 Background & Threat Intelligence Context

**NullReceiver** is a stealthy command-and-control resolution technique attributed to DPRK state-sponsored actors (such as the *Contagious Interview* campaign) targeting developer workstations and software supply chains (e.g., trojanized npm packages).

### How the Dead-Drop Mechanism Works:
1. Malicious dependencies avoid hardcoding C2 domains or IP addresses inside source code.
2. Instead, the malware connects to public Ethereum JSON-RPC nodes or explorer APIs to check outbound transactions sent from a hardcoded operator wallet (`0xa322E5f3D311D3080e6f0121063e9aDC2490Ef1a`).
3. The malware reads the recipient (`To`) destination address of the most recent zero-value transaction.
4. The 20 bytes of this destination address are decoded into the active command-and-control IPv4 server.

---

## 🔬 20-Byte Address Decoding Breakdown

Given a recipient address like `0x67B38e9b67B38E9b68656c6C6f6970626f742121`:

```
0x | 67 B3 8e 9b | 67 B3 8E 9b | 68 65 6c 6c 6f 69 70 62 6f 74 21 21
   |  Primary IP | Backup IP    |          ASCII Tracking Marker
```

| Chunk | Hex | Type | Decoded Result |
| :--- | :--- | :--- | :--- |
| **Prefix** | `0x` | Prefix | Standard Ethereum address prefix |
| **Bytes 0..3** | `67 B3 8e 9b` | Hex to Dec | **Primary C2: `103.179.142.155`** |
| **Bytes 4..7** | `67 B3 8E 9b` | Hex to Dec | **Backup C2: `103.179.142.155`** |
| **Bytes 8..19** | `68656c6c6f6970626f742121`| Hex to ASCII | **Signature Marker: `"helloipbot!!"`** |

---

## 🚀 Features

### 1. Web Threat Operations Dashboard (Vite + React)
- **Live C2 Resolution**: Queries the Ethereum ledger via Etherscan API V2 with Blockscout fallback.
- **Interactive 20-Byte Address Dissector**: Visualizes any 20-byte address into color-coded byte chips.
- **1-Click Suricata / Snort Rule**: Copies ready-to-deploy firewall drop rules.
- **Full On-Chain Ledger**: Inspect chronological history of all dead-drop updates.
- **IoC Exporter**: Download verified indicators as JSON or CSV.
- **Cyberpunk Dark Theme**: Built with glassmorphism, responsive data grids, and smooth micro-animations.

### 2. Standalone Python CLI Automation (`scripts/nullreceiver_tracker.py`)
- Automated background polling tool with configurable interval (`--interval 30`).
- Dual endpoint support: Etherscan API V2 + Blockscout fallback.
- Alerting upon detection of new on-chain C2 addresses.

---

## 🛠️ Quickstart

### Running the Web Dashboard Locally
```bash
# Clone the repository
git clone https://github.com/RD-Tarun/nullreceiver-sentinel.git
cd nullreceiver-sentinel

# Install dependencies
npm install

# Start development server
npm run dev
```

### Running the Python CLI Automation
```bash
python scripts/nullreceiver_tracker.py --continuous --interval 30
```

---

## 🛡️ Countermeasures & Defense
If your systems communicate with any of the resolved C2 IP addresses, implement immediate perimeter blocks:
```suricata
alert ip any any -> 103.179.142.155 any (msg:"ET MALWARE Contagious Interview / NullReceiver C2 Communication"; flow:established,to_server; classtype:trojan-activity; sid:9000101; rev:1;)
```

---

## 📄 License
MIT License
