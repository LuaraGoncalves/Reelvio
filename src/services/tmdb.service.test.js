import { jest } from '@jest/globals';
import { fetchFilteredMovies, fetchGenres } from './tmdb.service.js';

describe('filtros do catálogo', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.TMDB_API_KEY;
  const originalPublicKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;

  beforeEach(() => {
    process.env.TMDB_API_KEY = 'test-key';
    delete process.env.NEXT_PUBLIC_TMDB_API_KEY;
    global.fetch = jest.fn(async (url) => {
      const path = new URL(url).pathname;
      const data = {
        '/3/trending/all/day': { results: [{ id: 10, title: 'Destaque' }] },
        '/3/discover/movie': {
          results: [{ id: 1, title: 'Filme', popularity: 10 }]
        },
        '/3/discover/tv': {
          results: [{ id: 1, name: 'Série', popularity: 20 }]
        },
        '/3/genre/movie/list': {
          genres: [
            { id: 18, name: 'Drama' },
            { id: 27, name: 'Terror' }
          ]
        },
        '/3/genre/tv/list': {
          genres: [
            { id: 18, name: 'Drama' },
            { id: 10759, name: 'Ação e aventura' }
          ]
        }
      }[path];
      return { ok: Boolean(data), json: async () => data };
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = originalKey;
    if (originalPublicKey === undefined)
      delete process.env.NEXT_PUBLIC_TMDB_API_KEY;
    else process.env.NEXT_PUBLIC_TMDB_API_KEY = originalPublicKey;
  });

  it('mantém os destaques quando nenhum filtro é aplicado', async () => {
    const result = await fetchFilteredMovies({ type: 'all', page: 2 });
    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0][0])).toContain(
      '/trending/all/day'
    );
    expect(
      new URL(global.fetch.mock.calls[0][0]).searchParams.get('page')
    ).toBe('2');
  });

  it('aplica filtros a filmes e séries e mantém tipos com o mesmo id', async () => {
    const result = await fetchFilteredMovies({
      type: 'all',
      genre: '18',
      year: '2020',
      rating: '8',
      page: 2
    });
    expect(result.data.map((item) => item.media_type)).toEqual(['tv', 'movie']);
    const urls = global.fetch.mock.calls.map(([url]) => new URL(url));
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(url.searchParams.get('page')).toBe('2');
      expect(url.searchParams.get('with_genres')).toBe('18');
      expect(url.searchParams.get('vote_average.gte')).toBe('8');
    }
    expect(urls[0].searchParams.get('primary_release_year')).toBe('2020');
    expect(urls[1].searchParams.get('first_air_date_year')).toBe('2020');
  });

  it('reúne gêneros sem repetir os que têm o mesmo identificador', async () => {
    const result = await fetchGenres('all');
    expect(result.data.map((genre) => genre.id)).toEqual([10759, 18, 27]);
  });

  it('informa falha quando uma das buscas não responde', async () => {
    global.fetch.mockImplementation(async (url) => {
      const ok = new URL(url).pathname.endsWith('/movie');
      return { ok, json: async () => ({ results: [] }) };
    });
    const result = await fetchFilteredMovies({ type: 'all', year: '2020' });
    expect(result.ok).toBe(false);
  });
});
