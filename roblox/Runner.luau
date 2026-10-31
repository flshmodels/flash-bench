--!strict
-- Timings include loop/call overhead. Callbacks must not yield.
local Runner = {}

local function integer(value: number, low: number, high: number): boolean
	return type(value) == "number" and value == math.floor(value) and value >= low and value <= high
end

function Runner.measure(name: string, callback: () -> (), options: { iterations: number?, samples: number?, warmup: number? }?)
	assert(type(name) == "string" and #name >= 1 and #name <= 120 and not string.find(name, "[%c]"), "invalid case name")
	assert(type(callback) == "function", "callback must be a function")
	local settings = options or {}
	local iterations = settings.iterations or 100
	local samples = settings.samples or 30
	local warmup = settings.warmup or 10
	assert(integer(iterations, 1, 1000000), "iterations must be in 1..1000000")
	assert(integer(samples, 5, 1000), "samples must be in 5..1000")
	assert(integer(warmup, 0, 1000000), "warmup must be in 0..1000000")
	for _ = 1, warmup do callback() end
	local timings = {}
	for sample = 1, samples do
		local started = os.clock()
		for _ = 1, iterations do callback() end
		timings[sample] = (os.clock() - started) * 1000
	end
	return { name = name, iterations = iterations, samplesMs = timings }
end

return Runner
