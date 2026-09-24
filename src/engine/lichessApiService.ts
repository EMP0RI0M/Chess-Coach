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

  /**
   * Create an Open Challenge on Lichess (Strategy 1: No auth required, or with token)
   * POST /api/challenge/open
   */
  public async createOpenChallenge(options: {
    clockLimit?: number; // in seconds (e.g. 180, 300, 600)
    clockIncrement?: number; // in seconds (e.g. 0, 2, 5)
    rated?: boolean;
    color?: 'random' | 'white' | 'black';
    variant?: string;
    token?: string;
  } = {}): Promise<{
    id: string;
    url: string;
    urlWhite?: string;
    urlBlack?: string;
    status: string;
  } | null> {
    try {
      const {
        clockLimit = 300,
        clockIncrement = 3,
        rated = false,
        color = 'random',
        variant = 'standard',
        token,
      } = options;

      const params = new URLSearchParams();
      if (clockLimit > 0) {
        params.append('clock.limit', clockLimit.toString());
        params.append('clock.increment', clockIncrement.toString());
      }
      params.append('rated', rated ? 'true' : 'false');
      params.append('color', color);
      params.append('variant', variant);

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      };

      if (token && token.trim()) {
        headers['Authorization'] = `Bearer ${token.trim()}`;
      }

      const response = await fetch(`${this.baseUrl}/api/challenge/open`, {
        method: 'POST',
        headers,
        body: params.toString(),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          id: data.challenge?.id || data.id,
          url: data.challenge?.url || data.url || `https://lichess.org/${data.challenge?.id || data.id}`,
          urlWhite: data.urlWhite,
          urlBlack: data.urlBlack,
          status: data.challenge?.status || 'created',
        };
      }
    } catch {
      // Offline / API error
    }
    return null;
  }

  /**
   * Create a Direct Challenge against a specific Lichess user (Strategy 2)
   * POST /api/challenge/{username}
   */
  public async createDirectChallenge(
    username: string,
    options: {
      clockLimit?: number;
      clockIncrement?: number;
      rated?: boolean;
      color?: 'random' | 'white' | 'black';
      token: string;
    }
  ): Promise<{ id: string; url: string; status: string } | null> {
    try {
      const { clockLimit = 300, clockIncrement = 3, rated = false, color = 'random', token } = options;

      const params = new URLSearchParams();
      if (clockLimit > 0) {
        params.append('clock.limit', clockLimit.toString());
        params.append('clock.increment', clockIncrement.toString());
      }
      params.append('rated', rated ? 'true' : 'false');
      params.append('color', color);

      const response = await fetch(`${this.baseUrl}/api/challenge/${encodeURIComponent(username.trim())}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          id: data.challenge?.id || data.id,
          url: data.challenge?.url || `https://lichess.org/${data.challenge?.id || data.id}`,
          status: data.challenge?.status || 'created',
        };
      }
    } catch {
      // Offline / API error
    }
    return null;
  }

  /**
   * Get user's currently playing / ongoing live games
   * GET /api/account/playing
   */
  public async getOngoingGames(token: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/account/playing`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.nowPlaying || [];
      }
    } catch {
      // Offline
    }
    return [];
  }
}

export const lichessApiService = new LichessApiService();
