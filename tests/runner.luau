local Runner = require("../roblox/Runner")
local fs = require("@lune/fs")
local luau = require("@lune/luau")
local serde = require("@lune/serde")
luau.compile(fs.readFile("roblox/Example.server.luau"))
local called = 0
local result = Runner.measure("counter", function() called += 1 end, { iterations = 3, samples = 5, warmup = 2 })
assert(called == 17, "warmup must not leak into sample count")
assert(#result.samplesMs == 5 and result.iterations == 3 and result.name == "counter")
for _, ms in ipairs(result.samplesMs) do assert(ms >= 0 and ms < math.huge) end
for _, options in ipairs({ { iterations = 0 }, { samples = 4 }, { warmup = -1 }, { iterations = math.huge }, { samples = 5.5 } }) do
	assert(not pcall(function() Runner.measure("bad", function() end, options) end))
end
assert(not pcall(function() Runner.measure("error", function() error("expected") end) end))
assert(not pcall(function() Runner.measure("\n", function() end) end))
fs.writeDir("build")
fs.writeFile("build/actual.json", serde.encode("json", {
	schemaVersion = 1,
	environment = { runtime = "Lune CI", platform = "CI runner", context = "standalone", workload = "counter-v1" },
	cases = { result },
}))
print("Runner checks passed")
