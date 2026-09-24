import React, { useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Square } from 'chess.js';

interface ChessgroundViewProps {
  fen: string;
  isWhiteOrientation: boolean;
  boardSize: number;
  onMove: (from: Square, to: Square) => void;
  bestMoveArrow?: { from: string; to: string } | null;
  threats?: { from: string; to: string }[];
  boardTheme?: string;
  pieceTheme?: string;
}

export const ChessgroundView: React.FC<ChessgroundViewProps> = ({
  fen,
  isWhiteOrientation,
  boardSize,
  onMove,
  bestMoveArrow,
  threats = [],
  boardTheme = 'wood',
  pieceTheme = 'cburnett',
}) => {
  const webViewRef = useRef<any>(null);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; -webkit-user-select: none; }
    body, html { width: 100%; height: 100%; background: #0F172A; display: flex; justify-content: center; align-items: center; overflow: hidden; }
    #board-container { width: ${boardSize}px; height: ${boardSize}px; position: relative; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .cg-board { width: 100%; height: 100%; display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); }
    .sq { position: relative; display: flex; justify-content: center; align-items: center; }
    .sq.light { background: #F0D9B5; }
    .sq.dark { background: #B58863; }
    .sq.selected { background: rgba(245, 158, 11, 0.65) !important; }
    .sq.last-move { background: rgba(59, 130, 246, 0.4) !important; }
    .sq.threat { background: rgba(239, 68, 68, 0.4) !important; }
    .piece { font-size: ${boardSize / 9.5}px; pointer-events: none; }
    svg.overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
  </style>
</head>
<body>
  <div id="board-container">
    <div id="cg-board" class="cg-board"></div>
    <svg id="svg-overlay" class="overlay"></svg>
  </div>

  <script>
    const PIECE_SYMBOLS = {
      'w_p': '♙', 'w_n': '♘', 'w_b': '♗', 'w_r': '♖', 'w_q': '♕', 'w_k': '♔',
      'b_p': '♟', 'b_n': '♞', 'b_b': '♝', 'b_r': '♜', 'b_q': '♛', 'b_k': '♚'
    };

    let currentFen = "${fen}";
    let orientation = "${isWhiteOrientation ? 'white' : 'black'}";
    let selectedSquare = null;

    function renderBoard(fen, orient) {
      const boardEl = document.getElementById('cg-board');
      boardEl.innerHTML = '';
      
      const ranks = orient === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
      const files = orient === 'white' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a'];
      
      const fenBoard = fen.split(' ')[0];
      const rows = fenBoard.split('/');
      const pieceMap = {};

      for (let r = 0; r < 8; r++) {
        let colIdx = 0;
        for (const ch of rows[r]) {
          if (ch >= '1' && ch <= '8') {
            colIdx += parseInt(ch, 10);
          } else {
            const file = String.fromCharCode(97 + colIdx);
            const rank = 8 - r;
            const color = ch === ch.toUpperCase() ? 'w' : 'b';
            const type = ch.toLowerCase();
            pieceMap[file + rank] = color + '_' + type;
            colIdx++;
          }
        }
      }

      ranks.forEach((rank, rIdx) => {
        files.forEach((file, fIdx) => {
          const sq = file + rank;
          const isLight = (rIdx + fIdx) % 2 === 0;
          const sqDiv = document.createElement('div');
          sqDiv.className = 'sq ' + (isLight ? 'light' : 'dark');
          sqDiv.id = 'sq-' + sq;

          if (selectedSquare === sq) {
            sqDiv.classList.add('selected');
          }

          const pieceKey = pieceMap[sq];
          if (pieceKey) {
            const pSpan = document.createElement('span');
            pSpan.className = 'piece';
            pSpan.textContent = PIECE_SYMBOLS[pieceKey] || '';
            sqDiv.appendChild(pSpan);
          }

          sqDiv.addEventListener('click', () => handleSquareClick(sq, pieceKey));
          boardEl.appendChild(sqDiv);
        });
      });
    }

    function handleSquareClick(sq, pieceKey) {
      if (!selectedSquare) {
        if (pieceKey) {
          selectedSquare = sq;
          renderBoard(currentFen, orientation);
        }
      } else {
        if (selectedSquare === sq) {
          selectedSquare = null;
          renderBoard(currentFen, orientation);
        } else {
          // Send move to React Native
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'MOVE',
            from: selectedSquare,
            to: sq
          }));
          selectedSquare = null;
          renderBoard(currentFen, orientation);
        }
      }
    }

    // Handle incoming messages from React Native
    window.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'UPDATE_FEN') {
          currentFen = data.fen;
          orientation = data.isWhiteOrientation ? 'white' : 'black';
          renderBoard(currentFen, orientation);
        }
      } catch(e) {}
    });

    renderBoard(currentFen, orientation);
  </script>
</body>
</html>
`;

  // Push updates to the WebView whenever FEN or orientation changes
  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: 'UPDATE_FEN',
          fen,
          isWhiteOrientation,
        })
      );
    }
  }, [fen, isWhiteOrientation]);

  const handleMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'MOVE' && data.from && data.to) {
          onMove(data.from as Square, data.to as Square);
        }
      } catch {}
    },
    [onMove]
  );

  return (
    <View style={[styles.container, { width: boardSize, height: boardSize }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        onMessage={handleMessage}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        style={{ width: boardSize, height: boardSize, backgroundColor: 'transparent' }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
