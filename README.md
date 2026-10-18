# NullReceiver Threat Intelligence Monitor

Automated Command-and-Control (C2) Tracker & On-Chain Dead-Drop Resolver Decoder

- Live Telemetry Dashboard: https://nullreceiver-monitor.vercel.app
- Repository: https://github.com/RD-Tarun/nullreceiver-sentinel

---

## Threat Attribution & Intelligence Overview

**NullReceiver** is an on-chain dead-drop resolution mechanism attributed to **Democratic People's Republic of Korea (DPRK)** state-sponsored cyber operations (associated with the **Contagious Interview** campaign and the wider Lazarus Group threat cluster). 

The campaign targets software supply chains, developer environments, and cryptocurrency/Web3 organizations through trojanized dependencies (e.g., fraudulent npm packages and falsified job coding assignments).

### MITRE ATT&CK Mapping
- **T1102.001**: Web Service: Dead-Drop Resolver
- **T1071.001**: Application Layer Protocol: Web Protocols
- **T1195.001**: Supply Chain Compromise: Compromised Software Dependencies
- **T1027**: Obfuscated/Files or Information: Steganography / Asymmetric Encodings

### Mechanism of Action
To bypass static analysis and standard threat feed detection, malware implants do not contain hardcoded C2 hostnames or IP addresses. Instead, the malware leverages the Ethereum mainnet as an immutable, censorship-resistant DNS resolver:

1. **Transaction Polling**: The compromised environment queries public EVM JSON-RPC nodes or block explorers for recent outbound transactions from a designated operator wallet (`0xa322E5f3D311D3080e6f0121063e9aDC2490Ef1a`).
2. **Recipient Extraction**: The malware reads the 20-byte destination address (`To` address) of the latest 0-value transaction.
3. **Byte Decoding**: The raw bytes of the 20-byte Ethereum address are parsed to reconstruct the IPv4 address of the active staging server.
4. **Payload Retrieval**: The malware establishes an encrypted egress channel to retrieve second-stage payloads (e.g., XOR-encrypted payloads via endpoints such as `/0x/ls` and `/0x/cls`).

---

## 20-Byte Address Specification

Destination address structure demonstrated on active on-chain infrastructure (`0x67B38e9b67B38E9b68656c6C6f6970626f742121`):

```text
0x | 67 B3 8e 9b | 67 B3 8E 9b | 68 65 6c 6c 6f 69 70 62 6f 74 21 21
   |  Primary IP |  Backup IP   |             Marker
```

| Field | Byte Offset | Length | Encoding | Decoded Telemetry | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Prefix | 0 | 2 bytes | String | `0x` | Protocol prefix |
| Primary IPv4 | 2..10 | 4 bytes | Hex to Decimal | `103.179.142.155` | Primary C2 server endpoint |
| Backup IPv4 | 10..18 | 4 bytes | Hex to Decimal | `103.179.142.155` | Secondary / redundancy failover |
| Signature Marker | 18..42 | 12 bytes | ASCII String | `helloipbot!!` | Adversary tracking signature |

---

## System Components

### 1. Web Threat Operations Dashboard (`src/`)
High-performance React/Vite interface designed for Security Operations Center (SOC) teams, incident responders, and threat hunters:
- Continuous ledger polling across Etherscan API V2 and Blockscout fallback endpoints.
- Interactive 20-byte address byte decoder.
- Export capabilities for JSON and CSV indicator feeds.
- Automated generation of Snort and Suricata network perimeter blocking rules.

### 2. Standalone Python Telemetry Script (`scripts/nullreceiver_tracker.py`)
Lightweight, dependency-free Python automation engine for automated SIEM ingestion and continuous ledger monitoring.

---

## Deployment & Usage

### Web Interface

```bash
# Clone repository
git clone https://github.com/RD-Tarun/nullreceiver-sentinel.git
cd nullreceiver-sentinel

# Install dependencies and launch
npm install
npm run dev
```

Production build:
```bash
npm run build
```

Production deployment to Vercel:
```bash
npx vercel --prod
```

### Automation Engine

Single execution:
```bash
python scripts/nullreceiver_tracker.py
```

Continuous daemon mode (30-second interval with SIEM logging):
```bash
python scripts/nullreceiver_tracker.py --continuous --interval 30 --output-json iocs.json
```

---

## Network Defense & Perimeter Blocking

Suricata rule for perimeter network egress blocking:

```text
alert ip any any -> 103.179.142.155 any (msg:"ET MALWARE DPRK Contagious Interview / NullReceiver C2 Communication"; flow:established,to_server; reference:url,github.com/RD-Tarun/nullreceiver-sentinel; classtype:trojan-activity; sid:9000101; rev:1;)
```

---

## Indicators of Compromise (IoCs)

| Type | Indicator | Attribution / Note |
| :--- | :--- | :--- |
| ETH Wallet | `0xa322E5f3D311D3080e6f0121063e9aDC2490Ef1a` | DPRK Operator Dead-Drop Wallet |
| IPv4 C2 | `103.179.142.155` | Resolved Command & Control Staging Server |
| String Marker | `helloipbot!!` | Hardcoded On-Chain Address Canary |
| ETH Tx Hash | `0xbca9d15b78c0d79ff8970dae8681da78a9ebcdfbc963e8c1788eb9aaff0e17be` | Sample 0-Value Dead-Drop Broadcast |

---

## License

MIT
