#!/usr/bin/env python3
"""
NullReceiver C2 Dead-Drop Resolver Automation Tracker
Target: 0xa322E5f3D311D3080e6f0121063e9aDC2490Ef1a
Decodes recipient address bytes to IPv4 C2 address & ASCII signature.
"""

import sys
import time
import json
import argparse
import datetime
import urllib.request
import urllib.parse
from typing import Optional, Dict, Any, List

ETHERSCAN_API_KEY = "PMEHZSC3FV9KFMGPINSRQIABKXTMVX29T5"
DEFAULT_TARGET_ADDRESS = "0xa322E5f3D311D3080e6f0121063e9aDC2490Ef1a"

def decode_address_to_ip(raw_address: str) -> Dict[str, Any]:
    """
    Decodes an Ethereum destination address into IPv4 addresses & ASCII signature:
    - Strips '0x'
    - Byte 0..3 (8 chars)   -> Primary IPv4
    - Byte 4..7 (8 chars)   -> Secondary IPv4
    - Byte 8..19 (24 chars) -> ASCII tracking marker (e.g. 'helloipbot!!')
    """
    clean = raw_address.strip()
    if clean.lower().startswith("0x"):
        clean = clean[2:]
        
    if len(clean) != 40:
        raise ValueError(f"Invalid Ethereum address length: {len(clean)} characters (expected 40).")

    part_ip1 = clean[:8]
    part_ip2 = clean[8:16]
    part_marker = clean[16:]

    def hex_to_ip(hex_str: str) -> str:
        octets = [str(int(hex_str[i:i+2], 16)) for i in range(0, 8, 2)]
        return ".".join(octets)

    ip1 = hex_to_ip(part_ip1)
    ip2 = hex_to_ip(part_ip2)

    try:
        marker = bytes.fromhex(part_marker).decode("ascii", errors="replace")
    except Exception:
        marker = part_marker

    return {
        "raw_address": raw_address,
        "clean_hex": clean,
        "primary_ip": ip1,
        "secondary_ip": ip2,
        "marker": marker
    }

def fetch_txs_etherscan(wallet_address: str, api_key: str, count: int = 5) -> List[Dict[str, Any]]:
    """
    Queries Etherscan API V2 for recent transactions on the wallet address.
    """
    params = {
        "chainid": "1",
        "module": "account",
        "action": "txlist",
        "address": wallet_address,
        "startblock": "0",
        "endblock": "99999999",
        "page": "1",
        "offset": str(count),
        "sort": "desc",
        "apikey": api_key
    }
    url = f"https://api.etherscan.io/v2/api?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "NullReceiverTracker/1.0"})
    
    with urllib.request.urlopen(req, timeout=12) as response:
        payload = json.loads(response.read().decode())

    if payload.get("status") == "1" and isinstance(payload.get("result"), list):
        return payload["result"]
    else:
        raise RuntimeError(f"Etherscan error: {payload.get('message')} - {payload.get('result')}")

def fetch_txs_blockscout(wallet_address: str, count: int = 5) -> List[Dict[str, Any]]:
    """
    Fallback query via Blockscout v2 REST API.
    """
    url = f"https://eth.blockscout.com/api/v2/addresses/{wallet_address}/transactions"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=12) as response:
        payload = json.loads(response.read().decode())

    raw_items = payload.get("items", [])[:count]
    normalized = []
    for item in raw_items:
        tx_hash = item.get("hash", "")
        tx_from = item.get("from", {}).get("hash", "")
        tx_to = item.get("to", {}).get("hash", "")
        timestamp = item.get("timestamp", "")
        normalized.append({
            "hash": tx_hash,
            "from": tx_from,
            "to": tx_to,
            "timeStamp": timestamp,
            "value": item.get("value", "0")
        })
    return normalized

def poll_once(wallet_address: str, api_key: str) -> Optional[Dict[str, Any]]:
    try:
        txs = fetch_txs_etherscan(wallet_address, api_key, count=10)
    except Exception as err:
        print(f"[!] Etherscan API issue ({err}), trying Blockscout fallback...")
        try:
            txs = fetch_txs_blockscout(wallet_address, count=10)
        except Exception as err2:
            print(f"[!] Blockscout also failed: {err2}", file=sys.stderr)
            return None

    if not txs:
        print("[-] No transactions found.")
        return None

    # Filter for outbound transactions
    outbound = [t for t in txs if t.get("from", "").lower() == wallet_address.lower() and t.get("to")]
    if not outbound:
        latest = txs[0]
    else:
        latest = outbound[0]

    to_addr = latest.get("to")
    tx_hash = latest.get("hash")
    raw_ts = latest.get("timeStamp")
    
    try:
        ts_int = int(raw_ts)
        ts_str = datetime.datetime.fromtimestamp(ts_int, tz=datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    except Exception:
        ts_str = str(raw_ts)

    decoded = decode_address_to_ip(to_addr)
    return {
        "timestamp": ts_str,
        "tx_hash": tx_hash,
        "target_wallet": wallet_address,
        "to_address": to_addr,
        "primary_ip": decoded["primary_ip"],
        "secondary_ip": decoded["secondary_ip"],
        "marker": decoded["marker"]
    }

def main():
    parser = argparse.ArgumentParser(description="NullReceiver C2 Tracker & Dead-Drop Decoder")
    parser.add_argument("--address", default=DEFAULT_TARGET_ADDRESS, help="Target wallet address")
    parser.add_argument("--api-key", default=ETHERSCAN_API_KEY, help="Etherscan API key")
    parser.add_argument("--continuous", action="store_true", help="Run in continuous monitoring mode")
    parser.add_argument("--interval", type=int, default=30, help="Polling interval in seconds (default: 30)")
    parser.add_argument("--output-json", default="", help="Optional JSON file to append discovered IoCs")
    args = parser.parse_args()

    print("=" * 65)
    print("  NULLRECEIVER C2 DEAD-DROP RESOLVER AUTOMATION TRACKER")
    print("=" * 65)
    print(f"Target Wallet : {args.address}")
    print(f"API Provider  : Etherscan API V2 (Key: {args.api_key[:6]}...{args.api_key[-4:]})")
    print(f"Mode          : {'Continuous polling (' + str(args.interval) + 's)' if args.continuous else 'Single run'}")
    print("=" * 65)

    last_tx_hash = None

    while True:
        data = poll_once(args.address, args.api_key)
        if data:
            is_new = (data["tx_hash"] != last_tx_hash)
            if is_new:
                last_tx_hash = data["tx_hash"]
                print(f"\n[+] NEW/ACTIVE DEAD-DROP DETECTED at {data['timestamp']}")
                print(f"    Tx Hash     : {data['tx_hash']}")
                print(f"    To Address  : {data['to_address']}")
                print(f"    Primary C2  : {data['primary_ip']}")
                print(f"    Backup C2   : {data['secondary_ip']}")
                print(f"    Signature   : {data['marker']}")
                print("-" * 65)

                if args.output_json:
                    try:
                        try:
                            with open(args.output_json, "r") as f:
                                history = json.load(f)
                        except Exception:
                            history = []
                        history.append(data)
                        with open(args.output_json, "w") as f:
                            json.dump(history, f, indent=2)
                        print(f"    [i] Saved IoC to {args.output_json}")
                    except Exception as e:
                        print(f"    [!] Failed to save JSON: {e}")
            else:
                if args.continuous:
                    sys.stdout.write(f"\r[*] Polling... (no new transactions, active C2: {data['primary_ip']})")
                    sys.stdout.flush()

        if not args.continuous:
            break

        try:
            time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\n[*] Monitoring stopped by user.")
            break

if __name__ == "__main__":
    main()
