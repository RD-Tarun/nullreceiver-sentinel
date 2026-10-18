# NullReceiver Monitor

Monitoring and reverse-engineering tool for Ethereum on-chain Dead-Drop Resolvers (NullReceiver).

- Live Deployment: https://nullreceiver-monitor.vercel.app
- Source Code: https://github.com/RD-Tarun/nullreceiver-sentinel

## Technical Overview

The NullReceiver technique utilizes Ethereum transactions as an out-of-band dead-drop resolver. An operator wallet sends 0-value transactions where the 20-byte destination address encodes the target command-and-control (C2) IPv4 address and tracking metadata.

### 20-Byte Address Specification

Given destination address `0x67B38e9b67B38E9b68656c6C6f6970626f742121`:

```
0x | 67 B3 8e 9b | 67 B3 8E 9b | 68 65 6c 6c 6f 69 70 62 6f 74 21 21
   |  Primary IP |  Backup IP   |             Marker
```

| Field | Offset | Length | Encoding | Decoded Value |
| :--- | :--- | :--- | :--- | :--- |
| Prefix | 0 | 2 bytes | ASCII | `0x` |
| Primary IPv4 | 2..10 | 4 bytes | Hex to Decimal Octets | `103.179.142.155` |
| Backup IPv4 | 10..18 | 4 bytes | Hex to Decimal Octets | `103.179.142.155` |
| Signature Marker | 18..42 | 12 bytes | ASCII Bytes | `helloipbot!!` |

## Components

1. **Web Dashboard (`src/`)**: Real-time monitoring interface built with React and Vite. Queries Ethereum ledger via Etherscan API V2 and Blockscout API.
2. **CLI Tracker (`scripts/nullreceiver_tracker.py`)**: Standalone Python script for continuous background polling and logging.

## Usage

### Web Interface

```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

Deploy:
```bash
npx vercel --prod
```

### CLI Script

Single query:
```bash
python scripts/nullreceiver_tracker.py
```

Continuous monitoring (30s interval):
```bash
python scripts/nullreceiver_tracker.py --continuous --interval 30 --output-json iocs.json
```

## Network Countermeasures

Suricata rule for perimeter blocking:

```text
alert ip any any -> 103.179.142.155 any (msg:"ET MALWARE NullReceiver C2 Traffic"; flow:established,to_server; classtype:trojan-activity; sid:9000101; rev:1;)
```

## License

MIT
