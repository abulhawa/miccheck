import unittest
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('refinement', Path(__file__).with_name('refine-groq-annotations.py'))
refinement = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refinement)
align_words, refine = refinement.align_words, refinement.refine


class RefinementTest(unittest.TestCase):
    def clip(self):
        return {'durationSeconds': 1, 'referenceTranscript': 'HELLO', 'words': [{'text': 'hello', 'start': .1, 'end': .7, 'probability': .9}],
            'intervals': [{'start': 0, 'end': .2, 'label': 'uncertain'}, {'start': .2, 'end': .6, 'label': 'speech'},
                {'start': .6, 'end': .9, 'label': 'uncertain'}, {'start': .9, 'end': 1, 'label': 'nonspeech'}], 'reviewFlags': []}

    def test_downgrades_disagreement_without_promoting_uncertain(self):
        result = refine(self.clip(), {'text': 'hello', 'words': [{'word': 'hello', 'start': .3, 'end': .8}]})
        self.assertAlmostEqual(result['secondsByLabel']['speech'], .24)
        self.assertAlmostEqual(result['secondsByLabel']['nonspeech'], .1)
        self.assertAlmostEqual(result['refinement']['downgradedSeconds']['speech'], .16)
        self.assertNotIn('probability', result['words'][0])

    def test_invalid_timestamps_and_transcript_mismatch_leave_uncertainty(self):
        for response in [{'text': 'hello', 'words': [{'word': 'hello', 'start': .7, 'end': .1}]},
            {'text': 'goodbye', 'words': [{'word': 'goodbye', 'start': .1, 'end': .7}]}]:
            self.assertEqual(refine(self.clip(), response)['secondsByLabel']['uncertain'], 1)

    def test_alignment_does_not_match_substitutions_or_shift_repeated_words(self):
        self.assertEqual(align_words([{'text': 'a'}, {'text': 'a'}, {'text': 'cat'}],
            [{'text': 'a'}, {'text': 'dog'}, {'text': 'a'}, {'text': 'cat'}]), [(0, 0), (1, 2), (2, 3)])
        self.assertEqual(align_words([{'text': 'servant'}, {'text': 'maid'}], [{'text': 'servant-maid'}]), [(0, 0), (1, 0)])

    def test_out_of_source_word_only_downgrades_local_support(self):
        clip = self.clip()
        clip['referenceTranscript'] = 'HELLO WORLD'
        clip['words'].append({'text': 'world', 'start': .8, 'end': 1, 'probability': .9})
        result = refine(clip, {'text': 'hello world', 'words': [{'word': 'hello', 'start': .1, 'end': .7},
            {'word': 'world', 'start': .8, 'end': 1.2}]})
        self.assertAlmostEqual(result['secondsByLabel']['speech'], .4)
        self.assertEqual(result['secondsByLabel']['nonspeech'], 0)
        self.assertIn('provider_timestamp_out_of_bounds', result['reviewFlags'])


if __name__ == '__main__': unittest.main()
