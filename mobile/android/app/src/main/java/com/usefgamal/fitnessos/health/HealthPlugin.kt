package com.usefgamal.fitnessos.health

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId

/**
 * Health Connect, on the phone only: read weigh-ins (from a smart scale or
 * another app) and write finished workouts as exercise sessions. Optionally
 * also read daily steps, active calories, sleep and resting heart rate (from
 * the phone or a watch); each of those can be refused on its own. Nothing
 * leaves the phone; Health Connect is Android's own on-device store.
 */
@CapacitorPlugin(name = "Health")
class HealthPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val permissions = setOf(
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getWritePermission(ExerciseSessionRecord::class),
    )
    private val stepsPerm = HealthPermission.getReadPermission(StepsRecord::class)
    private val activePerm = HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)
    private val sleepPerm = HealthPermission.getReadPermission(SleepSessionRecord::class)
    private val restingPerm = HealthPermission.getReadPermission(RestingHeartRateRecord::class)
    private val extras = setOf(stepsPerm, activePerm, sleepPerm, restingPerm)
    private val contract = PermissionController.createRequestPermissionResultContract()

    private fun client(call: PluginCall): HealthConnectClient? {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect isn't available on this phone", "UNAVAILABLE")
            return null
        }
        return HealthConnectClient.getOrCreate(context)
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val status = when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
            else -> "unavailable"
        }
        if (status != "available") {
            call.resolve(JSObject().put("status", status).put("granted", false))
            return
        }
        val c = HealthConnectClient.getOrCreate(context)
        scope.launch {
            try {
                val granted = c.permissionController.getGrantedPermissions()
                call.resolve(
                    JSObject().put("status", status).put("granted", granted.containsAll(permissions))
                        .put("extras", JSArray(extras.filter { it in granted }.map { name(it) })),
                )
            } catch (e: Exception) {
                call.reject(e.message ?: "Could not read Health Connect permissions", e)
            }
        }
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        if (client(call) == null) return
        startActivityForResult(call, contract.createIntent(context, permissions + extras), "permissionsResult")
    }

    @ActivityCallback
    fun permissionsResult(call: PluginCall, result: ActivityResult) {
        val granted = contract.parseResult(result.resultCode, result.data)
        call.resolve(
            JSObject().put("granted", granted.containsAll(permissions))
                .put("extras", JSArray(extras.filter { it in granted }.map { name(it) })),
        )
    }

    private fun name(permission: String): String = when (permission) {
        stepsPerm -> "steps"
        activePerm -> "active_kcal"
        sleepPerm -> "sleep"
        else -> "resting_hr"
    }

    /**
     * The last `days` days (today included), one entry per local date:
     * [{ date, steps, active_kcal, sleep_min, resting_hr }]. A field is left
     * out when there's no data or its permission was refused. Sleep counts
     * toward the morning it ended on, minus time marked awake.
     */
    @PluginMethod
    fun readDaily(call: PluginCall) {
        val c = client(call) ?: return
        val days = (call.getInt("days") ?: 14).coerceIn(1, 60)
        scope.launch {
            try {
                val zone = ZoneId.systemDefault()
                val today = LocalDate.now(zone)
                val first = today.minusDays((days - 1).toLong())
                val out = sortedMapOf<String, JSObject>()
                fun day(d: LocalDate) = out.getOrPut(d.toString()) { JSObject().put("date", d.toString()) }
                val granted = c.permissionController.getGrantedPermissions()
                val range = TimeRangeFilter.between(first.atStartOfDay(), today.plusDays(1).atStartOfDay())

                if (stepsPerm in granted || activePerm in granted || restingPerm in granted) {
                    val metrics = buildSet<AggregateMetric<*>> {
                        if (stepsPerm in granted) add(StepsRecord.COUNT_TOTAL)
                        if (activePerm in granted) add(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)
                        if (restingPerm in granted) add(RestingHeartRateRecord.BPM_AVG)
                    }
                    val groups = c.aggregateGroupByPeriod(AggregateGroupByPeriodRequest(metrics, range, Period.ofDays(1)))
                    for (g in groups) {
                        val d = day(g.startTime.toLocalDate())
                        g.result[StepsRecord.COUNT_TOTAL]?.let { d.put("steps", it) }
                        g.result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.let { d.put("active_kcal", it.inKilocalories) }
                        g.result[RestingHeartRateRecord.BPM_AVG]?.let { d.put("resting_hr", it) }
                    }
                }

                if (sleepPerm in granted) {
                    // Start the evening before the first day so its night is included.
                    val since = first.minusDays(1).atTime(12, 0).atZone(zone).toInstant()
                    val minutes = mutableMapOf<LocalDate, Long>()
                    var token: String? = null
                    do {
                        val response = c.readRecords(
                            ReadRecordsRequest(SleepSessionRecord::class, TimeRangeFilter.after(since), pageToken = token),
                        )
                        for (r in response.records) {
                            val awake = r.stages
                                .filter { it.stage == SleepSessionRecord.STAGE_TYPE_AWAKE || it.stage == SleepSessionRecord.STAGE_TYPE_OUT_OF_BED }
                                .sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
                            val total = Duration.between(r.startTime, r.endTime).toMinutes() - awake
                            val date = r.endTime.atZone(zone).toLocalDate()
                            if (total > 0 && !date.isBefore(first)) minutes[date] = (minutes[date] ?: 0) + total
                        }
                        token = response.pageToken
                    } while (token != null)
                    for ((date, m) in minutes) day(date).put("sleep_min", m)
                }

                call.resolve(JSObject().put("days", JSArray(out.values.toList())))
            } catch (e: SecurityException) {
                call.reject("Fitness OS doesn't have permission to read that data", "PERMISSION", e)
            } catch (e: Exception) {
                call.reject(e.message ?: "Could not read daily activity", e)
            }
        }
    }

    /** Weigh-ins since `since` (ms), oldest first: [{ time, kg }]. */
    @PluginMethod
    fun readWeights(call: PluginCall) {
        val c = client(call) ?: return
        val since = Instant.ofEpochMilli((call.getDouble("since") ?: 0.0).toLong())
        scope.launch {
            try {
                val out = JSArray()
                var token: String? = null
                do {
                    val response = c.readRecords(
                        ReadRecordsRequest(WeightRecord::class, TimeRangeFilter.after(since), pageToken = token),
                    )
                    for (r in response.records) {
                        out.put(JSObject().put("time", r.time.toEpochMilli()).put("kg", r.weight.inKilograms))
                    }
                    token = response.pageToken
                } while (token != null)
                call.resolve(JSObject().put("weights", out))
            } catch (e: SecurityException) {
                call.reject("Fitness OS doesn't have permission to read weight", "PERMISSION", e)
            } catch (e: Exception) {
                call.reject(e.message ?: "Could not read weigh-ins", e)
            }
        }
    }

    /**
     * Write finished workouts: [{ id, start, end, title, kind, notes }]. Each
     * carries a clientRecordId, so sending the same workout again updates it
     * instead of adding a duplicate.
     */
    @PluginMethod
    fun writeWorkouts(call: PluginCall) {
        val c = client(call) ?: return
        val list = call.getArray("workouts") ?: JSArray()
        scope.launch {
            try {
                val zone = ZoneId.systemDefault().rules
                val records = (0 until list.length()).map { i ->
                    val w = list.getJSONObject(i)
                    val start = Instant.ofEpochMilli(w.getLong("start"))
                    val end = Instant.ofEpochMilli(w.getLong("end"))
                    ExerciseSessionRecord(
                        startTime = start,
                        startZoneOffset = zone.getOffset(start),
                        endTime = end,
                        endZoneOffset = zone.getOffset(end),
                        metadata = Metadata.manualEntry(
                            clientRecordId = "fitness-os-workout-${w.getInt("id")}",
                            clientRecordVersion = w.optLong("version", end.toEpochMilli()),
                        ),
                        exerciseType = exerciseType(w.optString("kind")),
                        title = w.optString("title").ifBlank { null },
                        notes = w.optString("notes").ifBlank { null },
                    )
                }
                if (records.isNotEmpty()) c.insertRecords(records)
                call.resolve(JSObject().put("written", records.size))
            } catch (e: SecurityException) {
                call.reject("Fitness OS doesn't have permission to write workouts", "PERMISSION", e)
            } catch (e: Exception) {
                call.reject(e.message ?: "Could not write workouts", e)
            }
        }
    }

    private fun exerciseType(kind: String): Int = when (kind) {
        "strength" -> ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING
        "calisthenics" -> ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS
        "walking" -> ExerciseSessionRecord.EXERCISE_TYPE_WALKING
        "biking" -> ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY
        "rowing" -> ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE
        "elliptical" -> ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL
        "stretching" -> ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING
        "tennis" -> ExerciseSessionRecord.EXERCISE_TYPE_TENNIS
        else -> ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT
    }

    override fun handleOnDestroy() {
        scope.cancel()
    }
}
