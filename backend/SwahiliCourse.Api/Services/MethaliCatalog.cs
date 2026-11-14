using System.Text.Json;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// The proverb pool for one course direction, loaded once at startup.
//
// Methali belong to no lesson. They are the Dose's hunt reward: the thing that
// makes it worth opening on a day the learner does not feel like studying,
// because a proverb is something you can repeat to another person. Editing the
// pool means editing the course's methali file — no code change, same as
// lessons.
//
// See docs/DAILY-PRACTICE-LOOP.md.
public class MethaliCatalog
{
    private readonly List<Methali> _all;

    private MethaliCatalog(List<Methali> all)
    {
        _all = all;
        // Index is the stable identity, so reordering the file would re-key the
        // cards. Appending is safe; inserting in the middle is not.
        for (var i = 0; i < _all.Count; i++) _all[i].Index = i;
    }

    public static MethaliCatalog FromFile(string path)
    {
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var parsed = JsonSerializer.Deserialize<List<Methali>>(File.ReadAllText(path), options) ?? new();
        return new MethaliCatalog(parsed);
    }

    public static MethaliCatalog Empty() => new(new List<Methali>());

    public IReadOnlyList<Methali> All => _all;
    public int Count => _all.Count;

    public Methali? ByKey(string key) =>
        _all.FirstOrDefault(m => m.Key == key);
}
