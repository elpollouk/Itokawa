# eLink Protocol

## Heartbeat request
### Example message
```
21 24 05
```

### Structure
| Byte | Notes |
|:-:|---|
| 0 | Command station request? |
| 1 | Ping? |
| 2 | Checksum |

## Heartbeat response from command station
### Example message
```
62 22 40 00
```

### Structure
| Byte | Notes |
|:-:|---|
| 0 | Command station response? |
| 1 | Pong? |
| 2 | Bit field? |
| 3 | Checksum |

## Loco Speed Control
### Example messages
```
E4 13 D0 D1 80 76
E4 13 CA AC B4 25
E4 13 CA AC 00 91
E4 13 CA AC 37 A6
```

### Stucture
| Byte | Notes |
|:-:|---|
| 0 | Loco control request? |
| 1 | Speed control? |
| 2 | Loco Id upper byte |
| 3 | Loco Id lower byte |
| 4 | Speed reverse = 0-127<br>Speed forward = 128-255 |
| 5 | Checksum |

## Mystery Message 1
### Example message
```
52 00 8B D9
```

### Stucture
| Byte | Notes |
|:-:|---|
| 0 | ??? |
| 1 | Broadcast? |
| 2 | ??? |
| 3 | Checksum |

### Notes
Sent immediately after initialising loco speeds after handshake.