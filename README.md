# MMM-Fintech

MMM-Fintech is a MagicMirror² module for displaying consolidated financial holdings
(crypto and traditional brokerage accounts) using a secure, low-frequency data
synchronization model.

## Features

- Once-daily holdings synchronization
- Separation of holdings data from intraday pricing
- Secure node_helper-based API access
- Provider-agnostic architecture (Coinbase, Plaid/Fidelity)

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/sonnyb9/MMM-Fintech.git
cd MMM-Fintech
npm install
