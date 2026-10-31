-- Place Runner (ModuleScript) and this Script together in ServerScriptService.
-- Use a separate test place. Start with small iteration counts.
local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")
assert(RunService:IsStudio(), "This example is for Studio testing")
local Runner = require(script.Parent.Runner)
local total = 0
local result = Runner.measure("sum-100", function()
	local sum = 0
	for i = 1, 100 do sum += i end
	total = sum
end, { iterations = 100, samples = 30, warmup = 10 })
assert(total == 5050)
local run = {
	schemaVersion = 1,
	environment = {
		runtime = "Roblox Studio - record your exact version",
		platform = "record your OS and CPU",
		context = "server",
		workload = "sum-100-v1",
	},
	cases = { result },
}
print("FLASH_BENCH_BEGIN")
print(HttpService:JSONEncode(run))
print("FLASH_BENCH_END")
-- Copy only the JSON between the markers into a local run.json file.
