#!/bin/bash
while true; do
  read -p "PINARCH> " input
  echo "$input" >> /home/iii/ROOTUIP/logs/claude-history.log
done