export interface LichessUserRating {
  games: number;
  rating: number;
  rd: number;
  prog: number;
  prov?: boolean;
}

export interface LichessUserProfile {
  id: string;
  username: string;
  perfs: {
    bullet?: LichessUserRating;
    blitz?: LichessUserRating;
    rapid?: LichessUserRating;
    classical?: LichessUserRating;
    correspondence?: LichessUserRating;
    chess960?: LichessUserRating;
    puzzle?: LichessUserRating;
  };
  createdAt?: number;
  seenAt?: number;
  title?: string;
  url: string;
  count: {
    all: number;
    rated: number;
    win: number;
    loss: number;
    draw: number;
  };
}

export interface LichessDailyPuzzle {
  game: {
    id: string;
    perf: { name: string };
    pgn: string;
  };
  puzzle: {
    id: string;
    rating: number;
    plays: number;
    initialPly: number;
    solution: string[];
    themes: string[];
  };
}

export interface LichessCloudEval {
  fen: string;
  depth: number;
  knodes: number;
  pvs: {
    moves: string;
    cp?: number;
    mate?: number;
  }[];
}

class LichessApiService {
  private baseUrl = 'https://lichess.org';

  /**
   * Fetch authenticated user profile using Personal API Access Token or OAuth2 token
   */
  public async getAccount(token: string): Promise<LichessUserProfile | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/account`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Offline / Network Error
    }
    return null;
  }

  /**
   * Fetch public user profile by username
   */
  public async getUserPublic(username: string): Promise<LichessUserProfile | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user/${encodeURIComponent(username.trim())}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Offline
    }
    return null;
  }

  /**
   * Fetch today's official Lichess Daily Puzzle
   */
  public async getDailyPuzzle(): Promise<LichessDailyPuzzle | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/puzzle/daily`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Offline
    }
    return null;
  }

  /**
   * Fetch Lichess Cloud Evaluation (Stockfish NNUE depth 20-40+ pre-calculated by Lichess cluster)
   */
  public async getCloudEvaluation(fen: string, multiPv: number = 3): Promise<LichessCloudEval | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Offline / not in cloud DB
    }
    return null;
  }

  /**
   * Fetch Opening Explorer statistics from Lichess Database
   */
  public async getOpeningStats(fen: string): Promise<any | null> {
    try {
      const response = await fetch(
        `https://explorer.lichess.ovh/lichess?fen=${encodeURIComponent(fen)}&speeds=blitz,rapid,classical&ratings=1600,1800,2000,2200,2500`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Offline
    }
    return null;
  }
}

export const lichessApiService = new LichessApiService();
