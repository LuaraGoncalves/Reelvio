import { getTmdbApiKey, requestTmdb } from './tmdb.client.js';
import {
  normalizeGenres,
  normalizeMediaList,
  normalizeMovieDetails
} from './tmdb.normalizers.js';
import {
  serviceFailure,
  serviceMissingConfig,
  serviceSuccess
} from './service-result.js';

export async function searchMulti(query = '') {
  if (!query) return serviceSuccess([]);
  if (!getTmdbApiKey()) return serviceMissingConfig('TMDB_API_KEY');

  const data = await requestTmdb('/search/multi', {
    query,
    page: 1
  });
  if (!data) return serviceFailure('Não foi possível buscar filmes e séries');

  return serviceSuccess(normalizeMediaList(data.results).slice(0, 5));
}

export async function fetchTrendingHomeMovies() {
  if (!getTmdbApiKey()) return serviceMissingConfig('TMDB_API_KEY');

  const data = await requestTmdb(
    '/trending/all/day',
    { page: 1 },
    { next: { revalidate: 3600 } }
  );
  if (!data) return serviceFailure('Não foi possível buscar destaques');

  return serviceSuccess(normalizeMediaList(data.results));
}

export async function fetchFilteredMovies({
  type = 'all',
  genre = 'all',
  year = 'all',
  rating = 'all',
  page = 1
} = {}) {
  if (!getTmdbApiKey()) return serviceMissingConfig('TMDB_API_KEY');

  if (type === 'all' && genre === 'all' && year === 'all' && rating === 'all') {
    const data = await requestTmdb('/trending/all/day', { page });
    if (!data) return serviceFailure('Não foi possível buscar conteúdos');
    return serviceSuccess(normalizeMediaList(data.results));
  }

  const types = type === 'all' ? ['movie', 'tv'] : [type];
  const responses = await Promise.all(
    types.map((mediaType) => {
      const params = { page, sort_by: 'popularity.desc' };
      if (genre !== 'all') params.with_genres = genre;
      if (year !== 'all') {
        params[
          mediaType === 'movie' ? 'primary_release_year' : 'first_air_date_year'
        ] = year;
      }
      if (rating !== 'all') params['vote_average.gte'] = rating;
      return requestTmdb(`/discover/${mediaType}`, params);
    })
  );
  if (responses.some((data) => !data)) {
    return serviceFailure('Não foi possível buscar conteúdos');
  }

  const results = responses.flatMap((data, index) =>
    normalizeMediaList(data.results, types[index])
  );
  if (types.length > 1) {
    results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }
  return serviceSuccess(results);
}

export async function fetchGenres(type = 'movie') {
  if (!getTmdbApiKey()) return serviceMissingConfig('TMDB_API_KEY');

  const types = type === 'all' ? ['movie', 'tv'] : [type];
  const responses = await Promise.all(
    types.map((mediaType) => requestTmdb(`/genre/${mediaType}/list`))
  );
  if (responses.some((data) => !data)) {
    return serviceFailure('Não foi possível buscar gêneros');
  }

  const genres = responses.flatMap((data) => normalizeGenres(data.genres));
  const uniqueGenres = [
    ...new Map(genres.map((genre) => [genre.id, genre])).values()
  ];
  return serviceSuccess(
    uniqueGenres.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  );
}

export async function fetchMovieDetailsAndRecs(id, type) {
  if (!getTmdbApiKey()) {
    return serviceMissingConfig('TMDB_API_KEY');
  }

  const [details, recData] = await Promise.all([
    requestTmdb(`/${type}/${id}`, {
      append_to_response: 'credits,videos'
    }),
    requestTmdb(`/${type}/${id}/recommendations`, {
      page: 1
    })
  ]);

  const normalizedDetails = normalizeMovieDetails(details, type);
  if (!normalizedDetails) {
    return serviceFailure('Não foi possível buscar detalhes do conteúdo');
  }

  return serviceSuccess({
    details: normalizedDetails,
    recommendations: normalizeMediaList(recData?.results, type)
  });
}

export async function fetchPopularMoviesForQuiz() {
  if (!getTmdbApiKey()) return serviceMissingConfig('TMDB_API_KEY');

  const data = await requestTmdb('/movie/popular', {
    page: 1
  });
  if (!data) return serviceFailure('Não foi possível buscar filmes do quiz');

  return serviceSuccess(normalizeMediaList(data.results, 'movie'));
}
