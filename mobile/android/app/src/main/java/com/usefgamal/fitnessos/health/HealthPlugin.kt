package com.usefgamal.fitnessos.health

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
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
import java.time.Instant
import java.time.ZoneId

/**
 * Health Connect, on the phone only: read weigh-ins (from a smart scale or
 * another app) and write finished workouts as exercise sessions. Nothing
 * leaves the phone; Health Connect is Android's own on-device store.
 */
@CapacitorPlugin(name = "Health")
class HealthPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val permissions = setOf(
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getWritePermission(ExerciseSessionRecord::class),
    )
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
                call.resolve(JSObject().put("status", status).put("granted", granted.containsAll(permissions)))
            } catch (e: Exception) {
                call.reject(e.message ?: "Could not read Health Connect permissions", e)
            }
        }
    }

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        if (client(call) == null) return
        startActivityForResult(call, contract.createIntent(context, permissions), "permissionsResult")
    }

    @ActivityCallback
    fun permissionsResult(call: PluginCall, result: ActivityResult) {
        val granted = contract.parseResult(result.resultCode, result.data)
        call.resolve(JSObject().put("granted", granted.containsAll(permissions)))
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
