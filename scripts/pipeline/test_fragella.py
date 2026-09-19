import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import fragella


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.local = {'id': '1', 'name': 'Sauvage', 'brand': 'Dior', 'year': 2015}
        self.remote = {'_id': 'sauvage', 'Name': 'Sauvage', 'Brand': 'Christian Dior', 'Year': '2015'}

    def test_identity_and_variants(self):
        self.assertEqual(fragella.match_record(self.local, [self.remote])[0], 'matched')
        for candidate in [dict(self.remote, Name='Sauvage Elixir'), dict(self.remote, Year='2018'), dict(self.remote, Brand='Other')]:
            self.assertEqual(fragella.match_record(self.local, [candidate])[0], 'review')
        self.assertEqual(fragella.match_record(self.local, [self.remote, self.remote])[0], 'review')
        self.assertEqual(fragella.match_record(self.local, [])[0], 'not_found')

    def test_response_shapes(self):
        self.assertEqual(fragella.candidates_from({'data': [self.remote]}), [self.remote])
        with self.assertRaises(RuntimeError):
            fragella.candidates_from({'error': 'no'})

    def test_cache_resume_and_quota(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(fragella, 'ROOT', Path(tmp)), patch.object(fragella, 'RAW', Path(tmp) / 'raw'), patch.object(fragella, 'catalog', return_value=[self.local]), patch.object(fragella, 'api_key', return_value='test'), patch('sys.argv', ['fragella', '--delay', '0']):
            with patch.object(fragella, 'request', side_effect=[{'usage': {'requests_remaining': 0}}]) as request:
                fragella.main()
                self.assertEqual(request.call_count, 1)
            with patch.object(fragella, 'request', side_effect=[{'usage': {'requests_remaining': 20}}, [self.remote]]) as request:
                fragella.main()
                self.assertEqual(request.call_count, 2)
            # A rerun rebuilds a lost report using saved responses without API calls.
            (Path(tmp) / 'raw/matches.json').unlink()
            with patch.object(fragella, 'request') as request:
                fragella.main()
                request.assert_not_called()
            report = json.loads((Path(tmp) / 'raw/matches.json').read_text())
            self.assertEqual(report['records']['1']['fragellaId'], 'sauvage')


if __name__ == '__main__':
    unittest.main()
